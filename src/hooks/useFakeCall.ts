import { useCallback, useState } from 'react';

export interface UseFakeCallResult {
  isCallActive: boolean;
  scheduleCall: (delaySeconds: number, callerName: string) => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => void;
}

/** TODO: Phase 7 — Advanced Safety. */
export function useFakeCall(): UseFakeCallResult {
  const [isCallActive, setIsCallActive] = useState(false);

  const scheduleCall = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 7'));
  }, []);

  const cancelCall = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 7'));
  }, []);

  const endCall = useCallback((): void => {
    setIsCallActive(false);
  }, []);

  return { isCallActive, scheduleCall, cancelCall, endCall };
}
