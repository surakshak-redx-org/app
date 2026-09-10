import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';

import { captureException } from '@/config/sentry';
import { APP_CONFIG, LOCATION_UNAVAILABLE } from '@/constants/config';
import { TIMING } from '@/constants/ui';
import {
  trackSmsAlertSent,
  trackSosCancelled,
  trackSosTriggered,
} from '@/services/analytics.service';
import { buildLocationUrl, getCurrentLocation } from '@/services/location.service';
import { recordSMSAlert, sendSOSAlert } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSOSStore } from '@/stores/sos.store';
import { useUserStore } from '@/stores/user.store';
import type { SOSTriggerMethod } from '@/types/emergency.types';

export interface UseSOSResult {
  isActive: boolean;
  countdown: number;
  triggerMethod: SOSTriggerMethod | null;
  /** Every SOS-button press goes here; a triple-tap inside the window fires SOS. */
  handleTap: () => void;
  /** Starts the countdown immediately (used by shake-to-SOS and tests). */
  trigger: (method: SOSTriggerMethod) => void;
  cancel: () => void;
}

/**
 * Owns the SOS lifecycle: triple-tap detection, the countdown timer, and the
 * SMS fan-out that runs once the countdown elapses. State lives in
 * `useSOSStore` so the dashboard and any overlay stay in sync.
 */
export function useSOS(): UseSOSResult {
  const isActive = useSOSStore((state) => state.isActive);
  const countdown = useSOSStore((state) => state.countdown);
  const triggerMethod = useSOSStore((state) => state.triggerMethod);
  const setActive = useSOSStore((state) => state.setActive);
  const setCountdown = useSOSStore((state) => state.setCountdown);
  const reset = useSOSStore((state) => state.reset);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);
  const methodRef = useRef<SOSTriggerMethod | null>(null);

  const clearTimer = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fanOut = useCallback(async (): Promise<void> => {
    try {
      const { emergencyContacts, profile } = useUserStore.getState();
      const surakshakUser = useAuthStore.getState().surakshakUser;
      const name = surakshakUser?.name ?? profile?.name ?? 'User';
      const language = surakshakUser?.language ?? profile?.language ?? 'en';

      let locationUrl = LOCATION_UNAVAILABLE;
      try {
        const fix = await getCurrentLocation();
        locationUrl = buildLocationUrl(fix.latitude, fix.longitude);
      } catch (locationError) {
        console.warn('SOS: location unavailable:', locationError);
      }

      const result = await sendSOSAlert(emergencyContacts, locationUrl, name, language);
      await recordSMSAlert({
        type: 'sos',
        locationUrl,
        contactsSent: result.sent,
        contactsFailed: result.failed,
      });
      trackSmsAlertSent('sos', result.sent.length, result.failed.length);
    } catch (error) {
      captureException(error);
    } finally {
      methodRef.current = null;
      reset();
    }
  }, [reset]);

  const tick = useCallback((): void => {
    const next = useSOSStore.getState().countdown - 1;
    if (next <= 0) {
      clearTimer();
      setCountdown(0);
      void fanOut();
    } else {
      setCountdown(next);
    }
  }, [clearTimer, fanOut, setCountdown]);

  const trigger = useCallback(
    (method: SOSTriggerMethod): void => {
      if (useSOSStore.getState().isActive) return;
      methodRef.current = method;
      setActive(true, method);
      trackSosTriggered(method);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      clearTimer();
      intervalRef.current = setInterval(tick, TIMING.SECOND_MS);
    },
    [clearTimer, setActive, tick],
  );

  const cancel = useCallback((): void => {
    clearTimer();
    trackSosCancelled(methodRef.current);
    methodRef.current = null;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
  }, [clearTimer, reset]);

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

  useEffect(() => clearTimer, [clearTimer]);

  return { isActive, countdown, triggerMethod, handleTap, trigger, cancel };
}
