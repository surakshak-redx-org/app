import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { captureException } from '@/config/sentry';
import { applyOtaUpdate, checkForOtaUpdate } from '@/config/updates';

export interface UseOtaUpdateResult {
  isUpdateAvailable: boolean;
  isChecking: boolean;
  isApplying: boolean;
  applyNow: () => Promise<void>;
}

/**
 * Checks for an OTA update once on mount and again every time the app
 * returns to the foreground — the same "opportunistic, on-foreground" idiom
 * `useSafeCheckin.ts` uses for its own reconciliation, since there is no
 * always-on background task in this app.
 */
export function useOtaUpdate(): UseOtaUpdateResult {
  const [isUpdateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setChecking] = useState(false);
  const [isApplying, setApplying] = useState(false);
  const isCheckingRef = useRef(false);

  const check = useCallback(async (): Promise<void> => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setChecking(true);
    try {
      const info = await checkForOtaUpdate();
      setUpdateAvailable(info.isAvailable);
    } finally {
      isCheckingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void check(), 0);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });

    return (): void => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [check]);

  const applyNow = useCallback(async (): Promise<void> => {
    setApplying(true);
    try {
      await applyOtaUpdate();
      // reloadAsync() restarts the app; this line is unreachable in
      // production but keeps state consistent if it's ever mocked in tests.
      setApplying(false);
    } catch (error) {
      captureException(error);
      setApplying(false);
      throw error;
    }
  }, []);

  return { isUpdateAvailable, isChecking, isApplying, applyNow };
}
