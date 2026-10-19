import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useState } from 'react';

import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { STORAGE_KEYS } from '@/constants/storage';
import i18n from '@/i18n';
import {
  trackLiveLocationExtended,
  trackLiveLocationStarted,
  trackLiveLocationStopped,
} from '@/services/analytics.service';
import {
  createLiveLocationSession,
  extendLiveLocationSession,
  getActiveLiveSession,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import { getCurrentLocation } from '@/services/location.service';
import { recordSMSAlert, sendLiveLocationShare } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import { formatClockTime } from '@/utils/date.utils';
import { getLocationUrl } from '@/utils/location.utils';
import { requestBackgroundLocationPermission } from '@/utils/permissions.utils';

export const BACKGROUND_LOCATION_TASK = 'surakshak-live-location';
const MS_PER_HOUR = 60 * 60 * 1000;

interface LocationTaskData {
  locations: Location.LocationObject[];
}

/**
 * Saves the session id together with its absolute end time so the background
 * task can enforce the expiry even when the JS expiry timer is suspended or the
 * app has been killed (BUG-043).
 */
export async function persistLiveSession(sessionId: string, expiresAt: Date): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.LIVE_LOCATION_SESSION_ID, sessionId],
    [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT, String(expiresAt.getTime())],
  ]);
}

/** Updates only the persisted end time (after an extension). Never throws. */
async function persistExpiry(expiresAt: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT, String(expiresAt.getTime()));
  } catch (error) {
    captureException(error);
  }
}

/**
 * Forgets the persisted session and stops native background tracking. Safe to
 * call more than once; never throws.
 */
export async function endBackgroundTracking(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.LIVE_LOCATION_SESSION_ID,
      STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT,
    ]);
  } catch (error) {
    captureException(error);
  }
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.warn('endBackgroundTracking: background task was not running:', error);
  }
}

function parseExpiry(raw: string | null): number | null {
  if (raw === null) return null;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * Defines the background location task. Must be called once at module load in
 * the root layout - `defineTask` has to run before the JS engine finishes the
 * first tick or the OS cannot hand a relaunch back to it.
 */
export function registerLiveLocationTask(): void {
  if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;

  TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      captureException(error);
      return;
    }
    const fix = data?.locations?.[data.locations.length - 1];
    if (fix === undefined) return;

    try {
      const stored = new Map(
        await AsyncStorage.multiGet([
          STORAGE_KEYS.LIVE_LOCATION_SESSION_ID,
          STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT,
        ]),
      );
      const sessionId = stored.get(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID) ?? null;
      if (sessionId === null) {
        // Orphaned task: there is no session to share to, so stop polling.
        await endBackgroundTracking();
        return;
      }

      let expiresAtMs = parseExpiry(stored.get(STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT) ?? null);
      if (expiresAtMs === null) {
        // Session predates expiry tracking, or the value is corrupt: bound it
        // instead of polling forever.
        expiresAtMs = Date.now() + APP_CONFIG.LIVE_LOCATION_MAX_HOURS * MS_PER_HOUR;
        await AsyncStorage.setItem(STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT, String(expiresAtMs));
      }

      if (Date.now() >= expiresAtMs) {
        await endBackgroundTracking();
        await stopLiveLocationSession(sessionId);
        return;
      }

      await updateLiveLocation(sessionId, fix.coords.latitude, fix.coords.longitude);
    } catch (taskError) {
      captureException(taskError);
    }
  });
}

export interface UseLiveLocationResult {
  isActive: boolean;
  sessionId: string | null;
  expiresAt: Date | null;
  currentLocationUrl: string | null;
  startSharing: (sharedWithUserIds: string[], durationHours: number) => Promise<void>;
  stopSharing: () => Promise<void>;
  extendTime: (hours: number) => Promise<void>;
}

/** Owns the live-location sharing lifecycle: session, background task, SMS. */
export function useLiveLocation(): UseLiveLocationResult {
  const isActive = useLocationStore((state) => state.isLiveLocationActive);
  const sessionId = useLocationStore((state) => state.liveLocationSessionId);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const setLiveLocationActive = useLocationStore((state) => state.setLiveLocationActive);

  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const rawUser = useAuthStore((state) => state.user);
  const userId = surakshakUser?.userId ?? rawUser?.uid ?? null;

  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const stopSharing = useCallback(async (): Promise<void> => {
    const activeSessionId = useLocationStore.getState().liveLocationSessionId;
    if (activeSessionId === null) return;

    // Local state and native tracking first: a failing Firestore call must
    // never leave the background task polling GPS.
    setLiveLocationActive(false);
    setExpiresAt(null);
    await endBackgroundTracking();

    try {
      await stopLiveLocationSession(activeSessionId);
    } catch (error) {
      captureException(error);
    }

    trackLiveLocationStopped();
  }, [setLiveLocationActive]);

  // Restore an active session on mount (e.g. after an app restart).
  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;

    void getActiveLiveSession(userId)
      .then(async (session) => {
        if (cancelled || session === null || !session.isActive) return;
        const expiry = session.expiresAt.toDate();
        if (expiry > new Date()) {
          setLiveLocationActive(true, session.id);
          setExpiresAt(expiry);
          await persistLiveSession(session.id, expiry);
        } else {
          // Only stop native tracking if it belongs to this expired session.
          const persistedId = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID);
          if (persistedId === null || persistedId === session.id) {
            await endBackgroundTracking();
          }
          await stopLiveLocationSession(session.id);
        }
      })
      .catch((error: unknown) => captureException(error));

    return (): void => {
      cancelled = true;
    };
  }, [userId, setLiveLocationActive]);

  // Auto-stop when the session expires. Always deferred through a timer so the
  // stop (which sets state) never runs synchronously inside the effect body.
  useEffect(() => {
    if (expiresAt === null || !isActive) return;
    const ms = Math.max(0, expiresAt.getTime() - Date.now());
    const timer = setTimeout(() => void stopSharing(), ms);
    return (): void => clearTimeout(timer);
  }, [expiresAt, isActive, stopSharing]);

  const startSharing = useCallback(
    async (sharedWithUserIds: string[], durationHours: number): Promise<void> => {
      if (userId === null) throw new Error('Not authenticated');

      const fix = await getCurrentLocation();
      const newSessionId = await createLiveLocationSession(
        userId,
        sharedWithUserIds,
        durationHours,
        fix.latitude,
        fix.longitude,
      );

      const sessionExpiry = new Date(Date.now() + durationHours * MS_PER_HOUR);
      await persistLiveSession(newSessionId, sessionExpiry);
      setLiveLocationActive(true, newSessionId);
      setExpiresAt(sessionExpiry);

      const backgroundGranted = await requestBackgroundLocationPermission();
      if (backgroundGranted) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: APP_CONFIG.LIVE_LOCATION_UPDATE_INTERVAL_SECONDS * 1000,
          distanceInterval: APP_CONFIG.LIVE_LOCATION_DISTANCE_INTERVAL_METERS,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: i18n.t('home.title'),
            notificationBody: i18n.t('location.sharingNotification'),
            notificationColor: COLORS.PRIMARY_RED,
          },
        });
      }

      const { emergencyContacts, profile } = useUserStore.getState();
      const selected = emergencyContacts.filter((contact) =>
        sharedWithUserIds.includes(contact.id),
      );
      const name = surakshakUser?.name ?? profile?.name ?? 'User';
      const language = surakshakUser?.language ?? profile?.language ?? 'en';
      const locationUrl = getLocationUrl(fix.latitude, fix.longitude);

      const untilTime = formatClockTime(new Date(Date.now() + durationHours * MS_PER_HOUR));
      const result = await sendLiveLocationShare(selected, locationUrl, name, untilTime, language);
      await recordSMSAlert({
        type: 'live_location',
        locationUrl,
        contactsSent: result.sent,
        contactsFailed: result.failed,
      });

      trackLiveLocationStarted(sharedWithUserIds.length, durationHours);
    },
    [userId, setLiveLocationActive, surakshakUser],
  );

  const extendTime = useCallback(
    async (hours: number): Promise<void> => {
      const activeSessionId = useLocationStore.getState().liveLocationSessionId;
      if (activeSessionId === null || userId === null) return;

      await extendLiveLocationSession(activeSessionId, hours);
      const refreshed = await getActiveLiveSession(userId);
      if (refreshed !== null) {
        const refreshedExpiry = refreshed.expiresAt.toDate();
        setExpiresAt(refreshedExpiry);
        await persistExpiry(refreshedExpiry);
      }

      trackLiveLocationExtended(hours);
    },
    [userId],
  );

  const currentLocationUrl =
    currentLocation === null
      ? null
      : getLocationUrl(currentLocation.latitude, currentLocation.longitude);

  return {
    isActive,
    sessionId,
    expiresAt,
    currentLocationUrl,
    startSharing,
    stopSharing,
    extendTime,
  };
}
