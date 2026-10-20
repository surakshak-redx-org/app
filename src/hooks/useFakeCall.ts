import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let mounted = true;

    void getPendingFakeCall()
      .then((pendingCall) => {
        if (mounted && pendingCall) {
          setCallerName(pendingCall.callerName);
          setIsCallActive(true);
          trackFakeCallTriggered();

          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      })
      .catch((error) => {
        console.error('Failed to recover pending fake call:', error);
      });

    return (): void => {
      mounted = false;
    };
  }, []);
  const clearPending = useCallback((): void => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleCall = useCallback(
    async (delaySeconds: number, name: string): Promise<void> => {
      clearPending();
      setCallerName(name);
      trackFakeCallScheduled(delaySeconds);

      if (Platform.OS === 'android') {
        const canUseFullScreen = await canUseFullScreenIntent();

        if (!canUseFullScreen) {
          console.warn(
            'Full-screen notification access is disabled. ' +
              'The fake call may not appear over the lock screen.',
          );
        }

        await scheduleNativeFakeCall(delaySeconds * TIMING.SECOND_MS, name);
        return;
      }

      timeoutRef.current = setTimeout((): void => {
        timeoutRef.current = null;
        setIsCallActive(true);
        trackFakeCallTriggered();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, delaySeconds * TIMING.SECOND_MS);
    },
    [clearPending],
  );

  const cancelCall = useCallback(async (): Promise<void> => {
    clearPending();

    if (Platform.OS === 'android') {
      await cancelScheduledFakeCall();
    }
  }, [clearPending]);

  const endCall = useCallback((): void => {
    clearPending();

    if (Platform.OS === 'android') {
      void cancelScheduledFakeCall();
    }

    setIsCallActive(false);
  }, [clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return { isCallActive, callerName, scheduleCall, cancelCall, endCall };
}
