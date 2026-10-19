import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { checkSmsPermission } from 'surakshak-native';

import { captureException } from '@/config/sentry';
import { APP_CONFIG, LOCATION_UNAVAILABLE } from '@/constants/config';
import { TIMING } from '@/constants/ui';
import {
  trackSmsAlertSent,
  trackSosCancelled,
  trackSosTriggered,
  trackSuspiciousFollowSosTriggered,
} from '@/services/analytics.service';
import { buildLocationUrl, getLocationWithTimeout } from '@/services/location.service';
import { recordSMSAlert, sendSOSAlert } from '@/services/sms.service';
import { beginSosSession, endSosSession, placeEmergencyCall } from '@/services/sos-session.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSOSStore } from '@/stores/sos.store';
import { useUserStore } from '@/stores/user.store';
import type { SOSTriggerMethod } from '@/types/emergency.types';
import type { EmergencyContact } from '@/types/user.types';
import { metroLogger } from '@/utils/logger.utils';
import { getCachedEmergencyContacts, getCachedUserInfo } from '@/utils/offline-cache.utils';
import { requestLocationPermission, requestSmsPermission } from '@/utils/permissions.utils';

export interface UseSOSResult {
  isActive: boolean;
  countdown: number;
  /** The countdown has elapsed and alerts are going out; cancel no longer applies. */
  isSending: boolean;
  triggerMethod: SOSTriggerMethod | null;
  /** Every SOS-button press goes here; a triple-tap inside the window fires SOS. */
  handleTap: () => void;
  /** Starts the countdown immediately (used by shake-to-SOS and tests). */
  trigger: (method: SOSTriggerMethod) => void;
  cancel: () => void;
  /** Siren / live tracking are running after dispatch. */
  isSessionActive: boolean;
  /** Ends the running SOS session. Safe to call repeatedly. */
  endSession: () => Promise<void>;
}

let activeInterval: ReturnType<typeof setInterval> | null = null;
let activeMethod: SOSTriggerMethod | null = null;
let activePermissionPromise: Promise<void> | null = null;
let activeLocationPermissionPromise: Promise<void> | null = null;

function clearActiveTimer(): void {
  if (activeInterval !== null) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

// Automatically clear the running timer if the store transitions to inactive from any caller.
useSOSStore.subscribe((state) => {
  if (!state.isActive && activeInterval !== null) {
    clearActiveTimer();
  }
});

/**
 * Owns the SOS lifecycle: triple-tap detection, the countdown timer, and the
 * fan-out (SMS, call, siren, live tracking) that runs once the countdown
 * elapses. State lives in `useSOSStore` so the dashboard and any overlay stay
 * in sync.
 */
export function useSOS(): UseSOSResult {
  const isActive = useSOSStore((state) => state.isActive);
  const countdown = useSOSStore((state) => state.countdown);
  const isSending = useSOSStore((state) => state.isSending);
  const isSessionActive = useSOSStore((state) => state.isSessionActive);
  const triggerMethod = useSOSStore((state) => state.triggerMethod);
  const setActive = useSOSStore((state) => state.setActive);
  const setCountdown = useSOSStore((state) => state.setCountdown);
  const setSending = useSOSStore((state) => state.setSending);
  const setLastOutcome = useSOSStore((state) => state.setLastOutcome);
  const reset = useSOSStore((state) => state.reset);

  const tapTimestampsRef = useRef<number[]>([]);

  /**
   * Android's silent send needs a runtime `SEND_SMS` grant. Ask while the
   * countdown runs so the user still has seconds to answer; if they decline,
   * `sms.service` falls back to the compose sheet instead of failing silently.
   */
  const ensureSmsPermission = useCallback((): void => {
    if (Platform.OS !== 'android') return;
    activePermissionPromise = (async (): Promise<void> => {
      try {
        if (!(await checkSmsPermission())) await requestSmsPermission();
      } catch (error) {
        captureException(error);
      }
    })();
  }, []);

  /** Asks for location during the countdown, after any SMS dialog has closed. */
  const ensureLocationPermission = useCallback((): void => {
    const afterSms = activePermissionPromise ?? Promise.resolve();
    activeLocationPermissionPromise = (async (): Promise<void> => {
      try {
        await afterSms;
        await requestLocationPermission();
      } catch (error) {
        captureException(error);
      }
    })();
  }, []);

  const fanOut = useCallback(async (): Promise<void> => {
    try {
      const { emergencyContacts, profile } = useUserStore.getState();
      const surakshakUser = useAuthStore.getState().surakshakUser;

      // Store empty (e.g. app relaunched offline before it rehydrates) —
      // fall back to the AsyncStorage cache. The cache includes predefined
      // helplines (never dispatchable), so they are filtered out.
      let contacts: EmergencyContact[] = emergencyContacts;
      try {
        if (contacts.length === 0) {
          contacts = (await getCachedEmergencyContacts()).filter((c) => !c.isPredefined);
        }
      } catch (error) {
        captureException(error);
      }

      const bounded = (pending: Promise<void> | null): Promise<void> =>
        Promise.race([
          pending ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, APP_CONFIG.ALERT_LOCATION_TIMEOUT_MS)),
        ]);

      // Siren and live tracking start now. On Android the call starts now
      // too; on iOS it waits until the SMS compose sheet closes.
      const locationReady = bounded(activeLocationPermissionPromise);
      beginSosSession(contacts, locationReady);
      const androidCall = Platform.OS === 'android' ? placeEmergencyCall() : null;

      try {
        const cachedUser =
          surakshakUser === null && profile === null ? await getCachedUserInfo() : null;
        const name = surakshakUser?.name ?? profile?.name ?? cachedUser?.name ?? 'User';
        const language =
          surakshakUser?.language ?? profile?.language ?? cachedUser?.language ?? 'en';

        // Bounded wait: a cold GPS must not hold the SMS back (BUG-007 / BUG-011).
        let locationUrl = LOCATION_UNAVAILABLE;
        const locate = locationReady
          .then(() => getLocationWithTimeout())
          .then((fix) => {
            locationUrl = buildLocationUrl(fix.latitude, fix.longitude);
          })
          .catch((locationError: unknown) => {
            console.warn('SOS: location unavailable:', locationError);
          });
        await Promise.all([locate, bounded(activePermissionPromise)]);

        const result = await sendSOSAlert(contacts, locationUrl, name, language);
        await recordSMSAlert({
          type: 'sos',
          locationUrl,
          contactsSent: result.sent,
          contactsFailed: result.failed,
        });
        trackSmsAlertSent('sos', result.sent.length, result.failed.length);
        const isFailed = result.sent.length === 0 && result.failed.length > 0;
        const isNoContacts = result.sent.length === 0 && result.failed.length === 0;
        setLastOutcome({
          sent: result.sent.length,
          failed: result.failed.length,
          error: isFailed ? 'failed' : isNoContacts ? 'no_contacts' : null,
        });
      } catch (error) {
        metroLogger.error('SOS alert dispatch failed', {
          domain: 'SOS',
          operation: 'fanOut',
          error,
        });
        captureException(error);
        setLastOutcome({ sent: 0, failed: 0, error: 'failed' });
      }

      await (androidCall ?? placeEmergencyCall());
    } finally {
      activeMethod = null;
      activePermissionPromise = null;
      activeLocationPermissionPromise = null;
      clearActiveTimer();
      // Ends the countdown/dispatch phase only; the session survives (store change).
      reset();
    }
  }, [reset, setLastOutcome]);

  const tick = useCallback((): void => {
    const next = useSOSStore.getState().countdown - 1;
    if (next <= 0) {
      clearActiveTimer();
      if (useSOSStore.getState().isSending) return; // never dispatch twice
      setCountdown(0);
      setSending(true);
      void fanOut();
    } else {
      setCountdown(next);
    }
  }, [fanOut, setCountdown, setSending]);

  const trigger = useCallback(
    (method: SOSTriggerMethod): void => {
      if (useSOSStore.getState().isActive) return;
      activeMethod = method;
      setActive(true, method);
      trackSosTriggered(method);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      clearActiveTimer();
      activeInterval = setInterval(tick, TIMING.SECOND_MS);
      ensureSmsPermission();
      ensureLocationPermission();
    },
    [ensureLocationPermission, ensureSmsPermission, setActive, tick],
  );

  const cancel = useCallback((): void => {
    // Once the fan-out has started the alerts are already on their way.
    if (useSOSStore.getState().isSending) return;
    clearActiveTimer();
    trackSosCancelled(activeMethod);
    activeMethod = null;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
  }, [reset]);

  const handleTap = useCallback((): void => {
    const now = Date.now();
    tapTimestampsRef.current = [
      ...tapTimestampsRef.current.filter((at) => now - at < APP_CONFIG.SOS_TAP_WINDOW_MS),
      now,
    ];
    if (tapTimestampsRef.current.length >= APP_CONFIG.SOS_TAP_COUNT) {
      tapTimestampsRef.current = [];
      trigger('button');
    }
  }, [trigger]);

  // Starts the countdown even when `isActive` flipped true from outside this
  // hook instance's own `trigger` call — e.g. the suspicious-follow alert in
  // `app/_layout.tsx` activates SOS directly on the shared store.
  useEffect(() => {
    if (isActive && activeInterval === null) {
      activeMethod = triggerMethod;
      trackSosTriggered(triggerMethod ?? 'button');
      if (triggerMethod === 'suspicious_follow') trackSuspiciousFollowSosTriggered();
      activeInterval = setInterval(tick, TIMING.SECOND_MS);
      ensureSmsPermission();
      ensureLocationPermission();
    }
  }, [isActive, triggerMethod, tick, ensureSmsPermission, ensureLocationPermission]);

  useEffect(() => {
    return (): void => {
      if (!useSOSStore.getState().isActive) {
        clearActiveTimer();
      }
    };
  }, []);

  return {
    isActive,
    countdown,
    isSending,
    triggerMethod,
    handleTap,
    trigger,
    cancel,
    isSessionActive,
    endSession: endSosSession,
  };
}
