import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
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
import { useAuthStore } from '@/stores/auth.store';
import { useSOSStore } from '@/stores/sos.store';
import { useUserStore } from '@/stores/user.store';
import type { SOSTriggerMethod } from '@/types/emergency.types';
import { metroLogger } from '@/utils/logger.utils';
import { getCachedEmergencyContacts, getCachedUserInfo } from '@/utils/offline-cache.utils';
import { requestSmsPermission } from '@/utils/permissions.utils';

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
}

let activeInterval: ReturnType<typeof setInterval> | null = null;
let activeMethod: SOSTriggerMethod | null = null;
let activePermissionPromise: Promise<void> | null = null;
let activeDeadline: number | null = null;
let wasInterrupted = false;

function clearActiveTimer(): void {
  if (activeInterval !== null) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  activeDeadline = null;
  wasInterrupted = false;
}

function startDeadline(): void {
  activeDeadline = Date.now() + useSOSStore.getState().countdown * TIMING.SECOND_MS;
}

// Single place that notices an interruption (incoming call, app switch) during a
// countdown, so `tick` can grant the cancel grace period whichever of the
// interval or the resume event happens to observe the expired deadline first.
AppState.addEventListener('change', (state) => {
  if (activeInterval === null) return;
  if (state !== 'active') wasInterrupted = true;
});

// Automatically clear the running timer if the store transitions to inactive from any caller.
useSOSStore.subscribe((state) => {
  if (!state.isActive && activeInterval !== null) {
    clearActiveTimer();
  }
});

/**
 * Owns the SOS lifecycle: triple-tap detection, the countdown timer, and the
 * SMS fan-out that runs once the countdown elapses. State lives in
 * `useSOSStore` so the dashboard and any overlay stay in sync.
 */
export function useSOS(): UseSOSResult {
  const isActive = useSOSStore((state) => state.isActive);
  const countdown = useSOSStore((state) => state.countdown);
  const isSending = useSOSStore((state) => state.isSending);
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

  const fanOut = useCallback(async (): Promise<void> => {
    try {
      const { emergencyContacts, profile } = useUserStore.getState();
      const surakshakUser = useAuthStore.getState().surakshakUser;

      // Store empty (e.g. app relaunched offline before it rehydrates) —
      // fall back to the AsyncStorage cache rather than sending nobody an
      // alert. The cache always includes the predefined helplines (never
      // dispatchable — see `resolveRecipients` in sms.service.ts), so only
      // its custom contacts count toward "do we have anyone to alert".
      const contacts =
        emergencyContacts.length > 0
          ? emergencyContacts
          : (await getCachedEmergencyContacts()).filter((contact) => !contact.isPredefined);

      const cachedUser =
        surakshakUser === null && profile === null ? await getCachedUserInfo() : null;
      const name = surakshakUser?.name ?? profile?.name ?? cachedUser?.name ?? 'User';
      const language = surakshakUser?.language ?? profile?.language ?? cachedUser?.language ?? 'en';

      // Bounded wait: a cold GPS, indoors or with no mobile data, used to
      // hold the SMS back indefinitely (BUG-007 / BUG-011).
      let locationUrl = LOCATION_UNAVAILABLE;
      const locate = getLocationWithTimeout()
        .then((fix) => {
          locationUrl = buildLocationUrl(fix.latitude, fix.longitude);
        })
        .catch((locationError: unknown) => {
          console.warn('SOS: location unavailable:', locationError);
        });
      // Give a still-open SMS permission dialog the same bounded window as
      // the location fix; an unanswered dialog falls back to the compose sheet.
      const permission = Promise.race([
        activePermissionPromise ?? Promise.resolve(),
        new Promise<void>((resolve) => setTimeout(resolve, APP_CONFIG.ALERT_LOCATION_TIMEOUT_MS)),
      ]);
      await Promise.all([locate, permission]);

      const result = await sendSOSAlert(contacts, locationUrl, name, language);
      await recordSMSAlert({
        type: 'sos',
        locationUrl,
        contactsSent: result.sent,
        contactsFailed: result.failed,
      });
      trackSmsAlertSent('sos', result.sent.length, result.failed.length);
      const isDraft = result.isDraftFallback === true;
      const isFailed = result.sent.length === 0 && result.failed.length > 0;
      const isNoContacts = result.sent.length === 0 && result.failed.length === 0;
      setLastOutcome({
        sent: result.sent.length,
        failed: result.failed.length,
        error: isDraft
          ? 'draft_fallback'
          : isFailed
            ? 'failed'
            : isNoContacts
              ? 'no_contacts'
              : null,
      });
    } catch (error) {
      metroLogger.error('SOS alert dispatch failed', {
        domain: 'SOS',
        operation: 'fanOut',
        error,
      });
      captureException(error);
      setLastOutcome({ sent: 0, failed: 0, error: 'failed' });
    } finally {
      activeMethod = null;
      activePermissionPromise = null;
      clearActiveTimer();
      reset();
    }
  }, [reset, setLastOutcome]);

  const tick = useCallback((): void => {
    // Already dispatching — a late/duplicate tick must not send a second alert.
    if (useSOSStore.getState().isSending) return;
    // Cancelled (store idle) — a leftover tick must never send or restart SOS.
    if (!useSOSStore.getState().isActive) {
      clearActiveTimer();
      return;
    }
    // Derive the count from a wall-clock deadline: JS timers are paused or
    // throttled while an incoming call takes the screen (BUG-101), so counting
    // ticks would let the countdown lag or stall.
    const next =
      activeDeadline === null
        ? useSOSStore.getState().countdown - 1
        : Math.ceil((activeDeadline - Date.now()) / TIMING.SECOND_MS);
    if (next <= 0 && wasInterrupted) {
      // Expired during an interruption — give a visible cancel window first.
      wasInterrupted = false;
      setCountdown(APP_CONFIG.SOS_RESUME_GRACE_SECONDS);
      startDeadline();
    } else if (next <= 0) {
      clearActiveTimer();
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
      startDeadline();
      activeInterval = setInterval(tick, TIMING.SECOND_MS);
      ensureSmsPermission();
    },
    [ensureSmsPermission, setActive, tick],
  );

  const cancel = useCallback((): void => {
    const { isActive: active, isSending: sending } = useSOSStore.getState();
    // Idempotent: a repeat tap after cancel (store already idle) is a no-op.
    // Once the fan-out has started the alerts are already on their way.
    if (!active || sending) return;
    const method = activeMethod;
    // Stop the timer and drop to idle synchronously, before anything else, so no
    // pending tick/effect can observe a live countdown and restart or send it.
    clearActiveTimer();
    activeMethod = null;
    reset();
    trackSosCancelled(method);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  // `app/_layout.tsx` activates SOS directly on the shared store. `trigger`
  // already set `activeInterval` synchronously for its own callers, so
  // this only ever fills in for an external activation.
  useEffect(() => {
    // Re-check the live store: `isActive` here is from the render that scheduled
    // this effect and can be stale if the user cancelled in the meantime.
    if (isActive && activeInterval === null && useSOSStore.getState().isActive) {
      activeMethod = triggerMethod;
      trackSosTriggered(triggerMethod ?? 'button');
      if (triggerMethod === 'suspicious_follow') trackSuspiciousFollowSosTriggered();
      startDeadline();
      activeInterval = setInterval(tick, TIMING.SECOND_MS);
      ensureSmsPermission();
    }
  }, [isActive, triggerMethod, tick, ensureSmsPermission]);

  // Catch up immediately when the app regains focus after a call/interruption.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && activeInterval !== null) tick();
    });
    return (): void => subscription.remove();
  }, [tick]);

  useEffect(() => {
    return (): void => {
      if (!useSOSStore.getState().isActive) {
        clearActiveTimer();
      }
    };
  }, []);

  return { isActive, countdown, isSending, triggerMethod, handleTap, trigger, cancel };
}
