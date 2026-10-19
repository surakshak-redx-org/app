import * as Location from 'expo-location';

import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import {
  BACKGROUND_LOCATION_TASK,
  endBackgroundTracking,
  persistLiveSession,
} from '@/hooks/useLiveLocation';
import i18n from '@/i18n';
import {
  createLiveLocationSession,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import { getLocationWithTimeout, watchLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useSOSStore } from '@/stores/sos.store';
import type { LocationData } from '@/types/location.types';
import type { EmergencyContact } from '@/types/user.types';
import { placeCall } from '@/utils/phone.utils';

// ASSUMPTIONS - confirm, or move to APP_CONFIG / a user setting.
const SOS_CALL_NUMBER = '112';
const SOS_SIREN_ENABLED = true;
const SOS_SESSION_HOURS = 2;
const STALE_FIX_MS = 2 * 60 * 1000;
const STOP_TIMEOUT_MS = 5000;
const MS_PER_HOUR = 60 * 60 * 1000;

let ownedSessionId: string | null = null;
let creating: Promise<string | null> | null = null;
let stopWatch: (() => void) | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

function currentUserId(): string | null {
  const { surakshakUser, user } = useAuthStore.getState();
  return surakshakUser?.userId ?? user?.uid ?? null;
}

function sessionHours(): number {
  return Math.min(SOS_SESSION_HOURS, APP_CONFIG.LIVE_LOCATION_MAX_HOURS);
}

async function ensureSession(
  contacts: EmergencyContact[],
  fix: LocationData,
): Promise<string | null> {
  if (ownedSessionId !== null) return ownedSessionId;
  creating ??= (async (): Promise<string | null> => {
    const userId = currentUserId();
    if (userId === null) throw new Error('SOS live tracking: not authenticated');
    const id = await createLiveLocationSession(
      userId,
      contacts.map((contact) => contact.id),
      sessionHours(),
      fix.latitude,
      fix.longitude,
    );
    if (!useSOSStore.getState().isSessionActive) {
      void stopLiveLocationSession(id).catch(captureException);
      return null;
    }
    ownedSessionId = id;
    await persistLiveSession(id, new Date(Date.now() + sessionHours() * MS_PER_HOUR));
    useLocationStore.getState().setLiveLocationActive(true, id);
    return id;
  })().finally(() => {
    creating = null;
  });
  return creating;
}

async function pushFix(contacts: EmergencyContact[], fix: LocationData): Promise<void> {
  if (Date.now() - fix.timestamp > STALE_FIX_MS) return;
  const id = await ensureSession(contacts, fix);
  if (id !== null && useSOSStore.getState().isSessionActive) {
    await updateLiveLocation(id, fix.latitude, fix.longitude);
  }
}

async function startLiveTracking(
  contacts: EmergencyContact[],
  ready: Promise<void>,
): Promise<void> {
  await ready;
  if (!useSOSStore.getState().isSessionActive) return;
  if (useLocationStore.getState().isLiveLocationActive) return;

  stopWatch = watchLocation((fix) => {
    void pushFix(contacts, fix).catch(captureException);
  });

  try {
    await pushFix(contacts, await getLocationWithTimeout());
  } catch (error) {
    captureException(error);
  }

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.granted && ownedSessionId !== null && useSOSStore.getState().isSessionActive) {
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
}

/** Starts siren and live tracking. Idempotent; never throws. */
export function beginSosSession(
  contacts: EmergencyContact[],
  ready: Promise<void> = Promise.resolve(),
): void {
  const store = useSOSStore.getState();
  if (store.isSessionActive) return;
  store.setSessionActive(true);
  if (SOS_SIREN_ENABLED) store.setSirenActive(true);
  endTimer = setTimeout(() => void endSosSession(), sessionHours() * MS_PER_HOUR);
  void startLiveTracking(contacts, ready).catch(captureException);
}

/** Opens the emergency call. Direct dialling is disabled in dev builds. */
export async function placeEmergencyCall(): Promise<void> {
  try {
    await placeCall(SOS_CALL_NUMBER, { allowDirect: !__DEV__ });
  } catch (error) {
    captureException(error);
  }
}

/** Idempotent teardown. Local state clears first; the Firestore stop is best-effort. */
export async function endSosSession(): Promise<void> {
  const store = useSOSStore.getState();
  if (!store.isSessionActive) return;
  store.setSessionActive(false);
  store.setSirenActive(false);

  if (endTimer !== null) clearTimeout(endTimer);
  endTimer = null;
  stopWatch?.();
  stopWatch = null;

  const id = ownedSessionId;
  ownedSessionId = null;
  if (id === null) return;

  useLocationStore.getState().setLiveLocationActive(false);
  await endBackgroundTracking();
  try {
    await withTimeout(stopLiveLocationSession(id), STOP_TIMEOUT_MS);
  } catch (error) {
    captureException(error);
  }
}
