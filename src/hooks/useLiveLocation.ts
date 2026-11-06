import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { ENV } from '@/config/env';
import { captureException } from '@/config/sentry';
import { LIVE_LOCATION_SESSION_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import {
  trackLiveLocationExpired,
  trackLiveLocationExtended,
  trackLiveLocationStarted,
  trackLiveLocationStopped,
} from '@/services/analytics.service';
import {
  createLiveLocationSession,
  extendLiveLocationSession,
  getActiveLiveSession,
  revokeShareToken,
  stopLiveLocationSession,
} from '@/services/firebase/live-location.service';
import {
  BACKGROUND_LOCATION_TASK,
  INITIAL_TRACKING_PROFILE,
  processLiveFix,
  resetTrail,
  startTrackingUpdates,
} from '@/services/live-tracking.task';
import { getCurrentLocation, watchLocation } from '@/services/location.service';
import { recordSMSAlert, sendLiveLocationShare } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import type { LiveTrackingProfile, LocationData, PlaceLocation } from '@/types/location.types';
import { formatClockTime } from '@/utils/date.utils';
import { getLocationUrl } from '@/utils/location.utils';
import { requestBackgroundLocationPermission } from '@/utils/permissions.utils';
import { buildTrackingUrl, generateShareToken } from '@/utils/tracking.utils';

const MS_PER_HOUR = 60 * 60 * 1000;

const SESSION_STORAGE_KEYS = [...LIVE_LOCATION_SESSION_STORAGE_KEYS];

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (existing !== null) return existing;
  const newId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, newId);
  return newId;
}

/** Plain-data copy of a destination, safe to JSON-serialise (drops any extra fields). */
function toStoredDestination(place: PlaceLocation): PlaceLocation {
  return { name: place.name, latitude: place.latitude, longitude: place.longitude };
}

/**
 * Wraps a foreground reading as the `LocationObject` the shared fix pipeline
 * expects. The foreground watcher reports no speed or heading, so the profile
 * falls back to walking pace (battery-based rules still apply).
 */
function toLocationObject(location: LocationData): Location.LocationObject {
  return {
    coords: {
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: null,
      accuracy: location.accuracy ?? null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: location.timestamp,
  };
}

/** Why a live location session ended: the user stopped it, or its timer ran out. */
export type LiveLocationEndReason = 'user' | 'expired';

/**
 * State of the public tracking link for the running session:
 * `active` it works, `revoked` the sender stopped it, `unavailable` this build
 * has no tracking page configured (contacts only got a static map pin).
 */
export type LiveLocationLinkStatus = 'active' | 'revoked' | 'unavailable';

export interface UseLiveLocationResult {
  isActive: boolean;
  sessionId: string | null;
  expiresAt: Date | null;
  sharedWithCount: number;
  currentLocationUrl: string | null;
  /**
   * `true` when the OS did not grant background location: updates then only
   * flow while the app is open, and the UI must say so.
   */
  foregroundOnly: boolean;
  trackingProfile: LiveTrackingProfile | null;
  /** 0–1, or `null` when unknown. */
  batteryLevel: number | null;
  /** Where the sender is heading, if set; the share ends automatically on arrival. */
  destination: PlaceLocation | null;
  /** The shareable tracking link, or `null` when it is revoked or not configured. */
  trackingUrl: string | null;
  linkStatus: LiveLocationLinkStatus;
  /** Stops the public link without ending the session. Contacts lose access immediately. */
  revokeLink: () => Promise<void>;
  startSharing: (
    sharedWithUserIds: string[],
    durationHours: number,
    destination?: PlaceLocation | null,
  ) => Promise<void>;
  /** `reason` defaults to `'user'`; the expiry timer passes `'expired'` so analytics can tell them apart. */
  stopSharing: (reason?: LiveLocationEndReason) => Promise<void>;
  extendTime: (hours: number) => Promise<void>;
}

/** Owns the live-location sharing lifecycle: session, background task, SMS. */
export function useLiveLocation(): UseLiveLocationResult {
  const isActive = useLocationStore((state) => state.isLiveLocationActive);
  const sessionId = useLocationStore((state) => state.liveLocationSessionId);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const trackingProfile = useLocationStore((state) => state.liveTrackingProfile);
  const batteryLevel = useLocationStore((state) => state.liveBatteryLevel);
  const setLiveLocationActive = useLocationStore((state) => state.setLiveLocationActive);

  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const rawUser = useAuthStore((state) => state.user);
  const userId = surakshakUser?.userId ?? rawUser?.uid ?? null;

  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [sharedWithCount, setSharedWithCount] = useState(0);
  const [foregroundOnly, setForegroundOnly] = useState(false);
  const [destination, setDestination] = useState<PlaceLocation | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const stopSharing = useCallback(
    async (reason: LiveLocationEndReason = 'user'): Promise<void> => {
      const activeSessionId = useLocationStore.getState().liveLocationSessionId;
      if (activeSessionId === null) return;

      await stopLiveLocationSession(activeSessionId);
      await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
      resetTrail(null);
      setLiveLocationActive(false);
      setExpiresAt(null);
      setSharedWithCount(0);
      setForegroundOnly(false);
      setDestination(null);
      setShareToken(null);

      try {
        const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      } catch (error) {
        console.warn('stopSharing: background task was not running:', error);
      }

      if (reason === 'expired') {
        trackLiveLocationExpired();
      } else {
        trackLiveLocationStopped();
      }
    },
    [setLiveLocationActive],
  );

  // Restore an active session on mount (e.g. after an app restart).
  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;

    const sessionPromise = getActiveLiveSession(userId);
    const localSessionPromise = AsyncStorage.getItem(STORAGE_KEYS.LIVE_LOCATION_SESSION_ID);
    const localDevicePromise = getOrCreateDeviceId();

    void Promise.all([sessionPromise, localSessionPromise, localDevicePromise])
      .then(async ([session, localSessionId, currentDeviceId]) => {
        if (cancelled || session === null || !session.isActive) return;
        // BUG-136: If this active session in Firestore belongs to another device
        // and was not started on this device, do not hijack or overwrite its tracking.
        if (
          session.deviceId &&
          session.deviceId !== currentDeviceId &&
          session.id !== localSessionId
        ) {
          return;
        }
        const expiry = session.expiresAt.toDate();
        if (expiry > new Date()) {
          // No running background task means this session only updates while the
          // app is open (background permission was denied or later revoked).
          const backgroundRunning = await Location.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK,
          ).catch(() => false);
          if (cancelled) return;
          setLiveLocationActive(true, session.id);
          setExpiresAt(expiry);
          setSharedWithCount(session.sharedWithUserIds.length);
          setForegroundOnly(!backgroundRunning);
          setDestination(session.destination ?? null);
          setShareToken(session.shareToken ?? null);
          void AsyncStorage.multiSet([
            [STORAGE_KEYS.LIVE_LOCATION_SESSION_ID, session.id],
            [STORAGE_KEYS.LIVE_LOCATION_USER_ID, userId],
            [STORAGE_KEYS.LIVE_LOCATION_DEVICE_ID, session.deviceId ?? currentDeviceId],
            [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT, String(expiry.getTime())],
            ...(session.destination
              ? [
                  [
                    STORAGE_KEYS.LIVE_LOCATION_DESTINATION,
                    JSON.stringify(toStoredDestination(session.destination)),
                  ] as [string, string],
                ]
              : []),
          ]);
        } else {
          void stopLiveLocationSession(session.id);
          void AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
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
    const timer = setTimeout(() => void stopSharing('expired'), ms);
    return (): void => clearTimeout(timer);
  }, [expiresAt, isActive, stopSharing]);

  // Without background permission there is no task, so keep the session fresh
  // from a foreground watch for as long as the app is open.
  useEffect(() => {
    if (!isActive || !foregroundOnly) return;
    return watchLocation((location) => {
      processLiveFix(toLocationObject(location), false).catch((error: unknown) =>
        captureException(error),
      );
    });
  }, [isActive, foregroundOnly]);

  const startSharing = useCallback(
    async (
      sharedWithUserIds: string[],
      durationHours: number,
      chosenDestination: PlaceLocation | null = null,
    ): Promise<void> => {
      if (userId === null) throw new Error('Not authenticated');

      const fix = await getCurrentLocation();
      const deviceId = await getOrCreateDeviceId();
      const newToken = await generateShareToken();
      const newSessionId = await createLiveLocationSession(
        userId,
        sharedWithUserIds,
        durationHours,
        fix.latitude,
        fix.longitude,
        deviceId,
        newToken,
        chosenDestination === null ? undefined : toStoredDestination(chosenDestination),
      );
      resetTrail({ latitude: fix.latitude, longitude: fix.longitude });

      const expiryDate = new Date(Date.now() + durationHours * MS_PER_HOUR);
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.LIVE_LOCATION_SESSION_ID, newSessionId],
        [STORAGE_KEYS.LIVE_LOCATION_USER_ID, userId],
        [STORAGE_KEYS.LIVE_LOCATION_DEVICE_ID, deviceId],
        [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT, String(expiryDate.getTime())],
      ]);
      await AsyncStorage.removeItem(STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE);
      if (chosenDestination === null) {
        await AsyncStorage.removeItem(STORAGE_KEYS.LIVE_LOCATION_DESTINATION);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEYS.LIVE_LOCATION_DESTINATION,
          JSON.stringify(toStoredDestination(chosenDestination)),
        );
      }
      setDestination(chosenDestination);
      setShareToken(newToken);
      setLiveLocationActive(true, newSessionId);
      useLocationStore.getState().setLiveTrackingStatus(INITIAL_TRACKING_PROFILE, null);
      setExpiresAt(expiryDate);
      setSharedWithCount(sharedWithUserIds.length);

      const backgroundGranted = await requestBackgroundLocationPermission();
      if (backgroundGranted) {
        await startTrackingUpdates(INITIAL_TRACKING_PROFILE);
      }
      setForegroundOnly(!backgroundGranted);

      const { emergencyContacts, profile } = useUserStore.getState();
      const selected = emergencyContacts.filter((contact) =>
        sharedWithUserIds.includes(contact.id),
      );
      const name = surakshakUser?.name ?? profile?.name ?? 'User';
      const language = surakshakUser?.language ?? profile?.language ?? 'en';
      // Prefer the live tracking link; fall back to a static pin if no tracking
      // page is configured for this build.
      const locationUrl =
        buildTrackingUrl(ENV.TRACKING_BASE_URL, newToken) ??
        getLocationUrl(fix.latitude, fix.longitude);

      const untilTime = formatClockTime(expiryDate);
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
        const newExpiry = refreshed.expiresAt.toDate();
        setExpiresAt(newExpiry);
        await AsyncStorage.setItem(
          STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT,
          String(newExpiry.getTime()),
        );
      }

      trackLiveLocationExtended(hours);
    },
    [userId],
  );

  const revokeLink = useCallback(async (): Promise<void> => {
    const activeSessionId = useLocationStore.getState().liveLocationSessionId;
    if (activeSessionId === null) return;

    await revokeShareToken(activeSessionId);
    setShareToken(null);
  }, []);

  const trackingUrl =
    shareToken === null ? null : buildTrackingUrl(ENV.TRACKING_BASE_URL, shareToken);
  const trackingConfigured = ENV.TRACKING_BASE_URL !== undefined;
  let linkStatus: LiveLocationLinkStatus = 'unavailable';
  if (trackingConfigured) linkStatus = shareToken === null ? 'revoked' : 'active';

  const currentLocationUrl =
    currentLocation === null
      ? null
      : getLocationUrl(currentLocation.latitude, currentLocation.longitude);

  return {
    isActive,
    sessionId,
    expiresAt,
    sharedWithCount,
    currentLocationUrl,
    foregroundOnly,
    trackingProfile,
    batteryLevel,
    destination,
    trackingUrl,
    linkStatus,
    revokeLink,
    startSharing,
    stopSharing,
    extendTime,
  };
}
