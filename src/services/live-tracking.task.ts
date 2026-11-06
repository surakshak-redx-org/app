import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { LIVE_TRACKING_PROFILES } from '@/constants/config';
import { STORAGE_KEYS } from '@/constants/storage';
import i18n from '@/i18n';
import { trackLiveLocationExpired } from '@/services/analytics.service';
import {
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import { useLocationStore } from '@/stores/location.store';
import type { LiveLocationTelemetry, LiveTrackingProfile } from '@/types/location.types';
import {
  nextStationarySince,
  selectTrackingProfile,
  shouldAppendPoint,
} from '@/utils/tracking.utils';

export const BACKGROUND_LOCATION_TASK = 'surakshak-live-location';

const PROFILE_NAMES: readonly LiveTrackingProfile[] = [
  'moving',
  'walking',
  'stationary',
  'low_battery',
];
const MS_PER_SECOND = 1000;

/** The profile every session starts in, before any speed is known. */
export const INITIAL_TRACKING_PROFILE: LiveTrackingProfile = 'walking';

interface LocationTaskData {
  locations: Location.LocationObject[];
}

interface TrackingState {
  profile: LiveTrackingProfile;
  stationarySinceMs: number | null;
}

/** Last coordinate written to the route trail, so fixes can be decimated. */
let lastTrailPoint: { latitude: number; longitude: number } | null = null;

/** Seeds trail decimation with the session's first fix. */
export function resetTrail(first: { latitude: number; longitude: number } | null): void {
  lastTrailPoint = first;
}

function isProfileName(value: unknown): value is LiveTrackingProfile {
  return PROFILE_NAMES.some((name) => name === value);
}

async function readTrackingState(): Promise<TrackingState> {
  const fallback: TrackingState = { profile: INITIAL_TRACKING_PROFILE, stationarySinceMs: null };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const { profile, stationarySinceMs } = parsed as Record<string, unknown>;
    return {
      profile: isProfileName(profile) ? profile : INITIAL_TRACKING_PROFILE,
      stationarySinceMs: typeof stationarySinceMs === 'number' ? stationarySinceMs : null,
    };
  } catch (error) {
    console.warn('readTrackingState: ignoring corrupt state:', error);
    return fallback;
  }
}

async function writeTrackingState(state: TrackingState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE, JSON.stringify(state));
}

interface BatteryReading {
  level: number | undefined;
  isCharging: boolean;
}

/** Battery level (0–1) and whether the phone is plugged in. Never throws. */
async function readBattery(): Promise<BatteryReading> {
  try {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    return {
      // expo-battery reports -1 when the level is unavailable.
      level: level >= 0 ? level : undefined,
      isCharging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch (error) {
    console.warn('readBattery failed:', error);
    return { level: undefined, isCharging: false };
  }
}

function accuracyFor(profile: LiveTrackingProfile): Location.Accuracy {
  return LIVE_TRACKING_PROFILES[profile].accuracy === 'high'
    ? Location.Accuracy.High
    : Location.Accuracy.Balanced;
}

/**
 * (Re)starts background updates at the given profile's rate. Calling it again
 * for a running task replaces its options, which is how a profile change is
 * applied without a gap in tracking.
 */
export async function startTrackingUpdates(profile: LiveTrackingProfile): Promise<void> {
  const settings = LIVE_TRACKING_PROFILES[profile];
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: accuracyFor(profile),
    timeInterval: settings.timeIntervalSeconds * MS_PER_SECOND,
    distanceInterval: settings.distanceIntervalMeters,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: i18n.t('home.title'),
      notificationBody: i18n.t('location.sharingNotification'),
      notificationColor: COLORS.PRIMARY_RED,
    },
  });
}

/** Device readings that accompany a fix; unusable values (negative speed/heading) are dropped. */
function telemetryFrom(
  coords: Location.LocationObjectCoords,
  battery: BatteryReading,
  profile: LiveTrackingProfile,
): LiveLocationTelemetry {
  const speed = coords.speed;
  const heading = coords.heading;
  const accuracy = coords.accuracy;
  return {
    trackingProfile: profile,
    isCharging: battery.isCharging,
    ...(battery.level !== undefined ? { batteryLevel: battery.level } : {}),
    ...(accuracy != null ? { accuracy } : {}),
    ...(speed != null && speed >= 0 ? { speed } : {}),
    ...(heading != null && heading >= 0 ? { heading } : {}),
  };
}

/**
 * Handles one fix: picks the sampling profile, writes the fix (with battery and
 * signal readings) to the session, and, when `applyProfile` is set and the
 * profile changed, retunes the background task.
 *
 * Shared by the background task and the foreground fallback. Only the
 * background task has a task to retune, so the fallback passes `false`.
 */
export async function processLiveFix(
  fix: Location.LocationObject,
  applyProfile: boolean,
): Promise<void> {
  const { coords } = fix;
  useLocationStore.getState().setCurrentLocation({
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp: fix.timestamp,
    ...(coords.accuracy != null ? { accuracy: coords.accuracy } : {}),
  });

  const [sessionId, sessionUserId] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID),
    AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_USER_ID),
  ]);
  if (sessionId === null || sessionUserId === null) return;

  const nowMs = Date.now();
  const [state, battery] = await Promise.all([readTrackingState(), readBattery()]);
  const speedMps = coords.speed != null && coords.speed >= 0 ? coords.speed : undefined;
  const stationarySinceMs = nextStationarySince(speedMps, state.stationarySinceMs, nowMs);
  const profile = selectTrackingProfile({
    speedMps,
    batteryLevel: battery.level,
    isCharging: battery.isCharging,
    stationarySinceMs,
    nowMs,
  });

  useLocationStore.getState().setLiveTrackingStatus(profile, battery.level ?? null);

  const coordinate = { latitude: coords.latitude, longitude: coords.longitude };
  const appendPoint = shouldAppendPoint(lastTrailPoint, coordinate);
  await updateLiveLocation(
    sessionId,
    coordinate.latitude,
    coordinate.longitude,
    appendPoint,
    telemetryFrom(coords, battery, profile),
  );
  if (appendPoint) lastTrailPoint = coordinate;

  const profileChanged = profile !== state.profile;
  if (profileChanged || stationarySinceMs !== state.stationarySinceMs) {
    await writeTrackingState({ profile, stationarySinceMs });
  }
  if (applyProfile && profileChanged) {
    try {
      await startTrackingUpdates(profile);
    } catch (error) {
      // Keep sharing at the old rate rather than losing the session.
      captureException(error);
    }
  }
}

/**
 * Defines the background location task. Must be called once at module load in
 * the root layout — `defineTask` has to run before the JS engine finishes the
 * first tick or the OS cannot hand a relaunch back to it.
 */
export function registerLiveLocationTask(): void {
  if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;

  TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      captureException(error);
      return;
    }

    try {
      const expiresAtStr = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT);
      if (expiresAtStr !== null) {
        const expiresAtMs = Number(expiresAtStr);
        if (!Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs) {
          const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID);
          if (sessionId !== null) {
            await stopLiveLocationSession(sessionId);
          }
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.LIVE_LOCATION_SESSION_ID,
            STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT,
            STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE,
          ]);
          trackLiveLocationExpired();
          return;
        }
      }

      const permissions = await Location.getBackgroundPermissionsAsync();
      if (!permissions.granted) {
        try {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        } catch {
          // The task may already have stopped after permission was revoked.
        }
        return;
      }

      const fix = data?.locations?.[0];
      if (fix === undefined) return;

      await processLiveFix(fix, true);
    } catch (taskError) {
      captureException(taskError);
    }
  });
}
