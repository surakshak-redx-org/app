import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  const scheduleCall = useCallback(
    (delaySeconds: number, name: string): Promise<void> => {
      clearPending();
      setCallerName(name);
      trackFakeCallScheduled(delaySeconds);
      timeoutRef.current = setTimeout((): void => {
        timeoutRef.current = null;
        setIsCallActive(true);
        trackFakeCallTriggered();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, delaySeconds * TIMING.SECOND_MS);
      return Promise.resolve();
    },
    [clearPending],
  );

  const cancelCall = useCallback((): Promise<void> => {
    clearPending();
    return Promise.resolve();
  }, [clearPending]);

  const endCall = useCallback((): void => {
    clearPending();
    setIsCallActive(false);
  }, [clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return { isCallActive, callerName, scheduleCall, cancelCall, endCall };
}
