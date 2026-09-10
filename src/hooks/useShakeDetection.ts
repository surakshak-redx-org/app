import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';

import { APP_CONFIG } from '@/constants/config';

/**
 * Fires `onShake` after `SHAKE_COUNT_REQUIRED` above-threshold accelerometer
 * readings inside `SHAKE_WINDOW_MS`. Pass a `useCallback`-stable `onShake`.
 * The subscription only exists while `enabled` is true.
 */
export function useShakeDetection(onShake: () => void, enabled: boolean): void {
  const shakeTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    shakeTimestampsRef.current = [];
    Accelerometer.setUpdateInterval(APP_CONFIG.SHAKE_SAMPLE_INTERVAL_MS);

    const subscription = Accelerometer.addListener(({ x, y, z }): void => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude <= APP_CONFIG.SHAKE_THRESHOLD) return;

      const now = Date.now();
      shakeTimestampsRef.current = [
        ...shakeTimestampsRef.current.filter((at) => now - at < APP_CONFIG.SHAKE_WINDOW_MS),
        now,
      ];

      if (shakeTimestampsRef.current.length >= APP_CONFIG.SHAKE_COUNT_REQUIRED) {
        shakeTimestampsRef.current = [];
        onShake();
      }
    });

    return (): void => {
      subscription.remove();
    };
  }, [enabled, onShake]);
}
