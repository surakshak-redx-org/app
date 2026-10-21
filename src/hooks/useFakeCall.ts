import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  cancelScheduledFakeCall,
  canUseFullScreenIntent,
  getPendingFakeCall,
  scheduleFakeCall as scheduleNativeFakeCall,
} from 'surakshak-native';

import { TIMING } from '@/constants/ui';
import { trackFakeCallScheduled, trackFakeCallTriggered } from '@/services/analytics.service';

export interface UseFakeCallResult {
  isCallActive: boolean;
  callerName: string;
  scheduleCall: (delaySeconds: number, callerName: string) => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => void;
}

/**
 * Schedules a fake incoming call after a delay. The "call" is purely visual —
 * `isCallActive` drives a full-screen overlay; there is no real telephony.
 */
export function useFakeCall(): UseFakeCallResult {
  const [isCallActive, setIsCallActive] = useState(false);
  const [callerName, setCallerName] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback((): void => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const triggerCall = useCallback(
    (name: string): void => {
      clearPending();
      setCallerName(name);
      setIsCallActive(true);
      trackFakeCallTriggered();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    [clearPending],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let mounted = true;

    const checkPending = (): void => {
      void getPendingFakeCall()
        .then((pendingCall) => {
          if (mounted && pendingCall) {
            triggerCall(pendingCall.callerName);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to recover pending fake call:', error);
        });
    };

    checkPending();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPending();
      }
    });

    return (): void => {
      mounted = false;
      subscription.remove();
    };
  }, [triggerCall]);

  const scheduleCall = useCallback(
    async (delaySeconds: number, name: string): Promise<void> => {
      clearPending();
      setCallerName(name);

      if (delaySeconds <= 0) {
        if (Platform.OS === 'android') {
          await cancelScheduledFakeCall().catch(() => undefined);
        }
        triggerCall(name);
        return;
      }

      trackFakeCallScheduled(delaySeconds);

      if (Platform.OS === 'android') {
        const canUseFullScreen = await canUseFullScreenIntent().catch(() => true);

        if (!canUseFullScreen) {
          console.warn(
            'Full-screen notification access is disabled. ' +
              'The fake call may not appear over the lock screen.',
          );
        }

        await scheduleNativeFakeCall(delaySeconds * TIMING.SECOND_MS, name).catch(
          (error: unknown) => {
            console.warn('Native alarm schedule failed, falling back to JS timer:', error);
          },
        );
      }

      timeoutRef.current = setTimeout((): void => {
        timeoutRef.current = null;
        triggerCall(name);
      }, delaySeconds * TIMING.SECOND_MS);
    },
    [clearPending, triggerCall],
  );

  const cancelCall = useCallback(async (): Promise<void> => {
    clearPending();

    if (Platform.OS === 'android') {
      await cancelScheduledFakeCall().catch(() => undefined);
    }
  }, [clearPending]);

  const endCall = useCallback((): void => {
    clearPending();

    if (Platform.OS === 'android') {
      void cancelScheduledFakeCall().catch(() => undefined);
    }

    setIsCallActive(false);
  }, [clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return { isCallActive, callerName, scheduleCall, cancelCall, endCall };
}
