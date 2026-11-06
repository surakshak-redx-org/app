import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { LIVE_TRACKING_PROFILES } from '@/constants/config';
import { LIVE_LOCATION_SESSION_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import i18n from '@/i18n';
import { trackLiveLocationArrived, trackLiveLocationExpired } from '@/services/analytics.service';
import {
  markLiveLocationArrived,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import { scheduleLocalNotification } from '@/services/notification.service';
import { useLocationStore } from '@/stores/location.store';
import type {
  LiveLocationTelemetry,
  LiveTrackingProfile,
  PlaceLocation,
} from '@/types/location.types';
import {
  type ArrivalState,
  INITIAL_ARRIVAL_STATE,
  distanceMeters,
  evaluateArrival,
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
  arrival: ArrivalState;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseArrival(value: unknown): ArrivalState {
  if (!isRecord(value)) return INITIAL_ARRIVAL_STATE;
  return {
    armed: value.armed === true,
    insideFixes: typeof value.insideFixes === 'number' ? value.insideFixes : 0,
  };
}

function isPlaceLocation(value: unknown): value is PlaceLocation {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude)
  );
}

/** The destination stored for the running session, or `null` if none / unreadable. */
function parseDestination(raw: string | null): PlaceLocation | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlaceLocation(parsed) ? parsed : null;
  } catch (error) {
    console.warn('parseDestination: ignoring corrupt destination:', error);
    return null;
  }
}

async function readTrackingState(): Promise<TrackingState> {
  const fallback: TrackingState = {
    profile: INITIAL_TRACKING_PROFILE,
    stationarySinceMs: null,
    arrival: INITIAL_ARRIVAL_STATE,
  };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const { profile, stationarySinceMs, arrival } = parsed;
    return {
      profile: isProfileName(profile) ? profile : INITIAL_TRACKING_PROFILE,
      stationarySinceMs: typeof stationarySinceMs === 'number' ? stationarySinceMs : null,
      arrival: parseArrival(arrival),
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
 * Ends a session because the sender reached the destination: marks it
 * `arrived` (so the tracking page can say so), stops tracking, clears local
 * session state and tells the sender. The remote write goes first, so a
 * failure leaves the session running and the next fix retries.
 */
async function finishAsArrived(sessionId: string): Promise<void> {
  await markLiveLocationArrived(sessionId);
  await AsyncStorage.multiRemove([...LIVE_LOCATION_SESSION_STORAGE_KEYS]);
  useLocationStore.getState().setLiveLocationActive(false);

  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    console.warn('finishAsArrived: could not stop the background task:', error);
  }

  trackLiveLocationArrived();
  await scheduleLocalNotification(
    i18n.t('location.arrivedNotificationTitle'),
    i18n.t('location.arrivedNotificationBody'),
    0,
    { type: 'live_location_arrived' },
  ).catch((error: unknown) => captureException(error));
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

  const [sessionId, sessionUserId, rawDestination] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID),
    AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_USER_ID),
    AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_DESTINATION),
  ]);
  if (sessionId === null || sessionUserId === null) return;
  const destination = parseDestination(rawDestination);

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

  const arrivalCheck =
    destination === null
      ? { state: state.arrival, arrived: false }
      : evaluateArrival(
          state.arrival,
          distanceMeters(coordinate, destination),
          coords.accuracy ?? undefined,
        );

  const profileChanged = profile !== state.profile;
  const arrivalChanged =
    arrivalCheck.state.armed !== state.arrival.armed ||
    arrivalCheck.state.insideFixes !== state.arrival.insideFixes;
  if (profileChanged || stationarySinceMs !== state.stationarySinceMs || arrivalChanged) {
    await writeTrackingState({ profile, stationarySinceMs, arrival: arrivalCheck.state });
  }

  if (arrivalCheck.arrived) {
    await finishAsArrived(sessionId);
    return;
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
          await AsyncStorage.multiRemove([...LIVE_LOCATION_SESSION_STORAGE_KEYS]);
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
