import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { captureException } from '@/config/sentry';
import { APP_CONFIG } from '@/constants/config';
import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { useDisguiseStore } from '@/stores/disguise.store';

/**
 * Loads the Disguise Mode flag before the navigator renders, and re-locks
 * the calculator once the app has spent `DISGUISE_RELOCK_AFTER_SECONDS` in
 * the background.
 *
 * The unlock flag used to live for the whole process, so after one PIN
 * entry, leaving and reopening the app (a resume, not a cold start, on
 * Android) landed straight on the real Home tab (BUG-024). The grace period
 * keeps short trips out of the app — the image picker, the SMS sheet, the
 * dialer — from throwing away whatever screen the user was on.
 *
 * @returns whether the flag has been read (render the navigator only then).
 */
export function useDisguiseGate(): boolean {
  const isEnabled = useDisguiseStore((state) => state.isEnabled);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.DISGUISE_ENABLED)
      .then((flag) => useDisguiseStore.getState().setEnabled(flag === STORAGE_FLAG_ON))
      .catch((error: unknown) => {
        captureException(error);
        useDisguiseStore.getState().setEnabled(false);
      });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (backgroundedAt === null) return;
      const awaySeconds = (Date.now() - backgroundedAt) / 1000;
      if (awaySeconds >= APP_CONFIG.DISGUISE_RELOCK_AFTER_SECONDS) {
        useDisguiseStore.getState().lock();
      }
    });
    return (): void => subscription.remove();
  }, []);

  return isEnabled !== null;
}
