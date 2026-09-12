import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { APP_CONFIG } from '@/constants/config';
import { NOTIFICATION_CHANNEL_IDS, NOTIFICATION_IDS } from '@/constants/notifications';

/**
 * Android-only: a low-importance, non-dismissible-looking notification that
 * signals shake detection is running, matching the OS's expectation that a
 * long-lived background listener shows the user it's active. Silent no-op on
 * iOS, which backgrounds this listener anyway once the app is suspended.
 */
async function registerForegroundService(title: string, body: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_IDS.FOREGROUND, {
      name: 'Surakshak Protection',
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
      sound: null,
    });
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.SHAKE_DETECTION_ACTIVE,
      content: { title, body, sticky: true, data: { type: 'foreground_service' } },
      trigger: null,
    });
  } catch (error) {
    console.warn('registerForegroundService failed:', error);
  }
}

async function removeForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_IDS.SHAKE_DETECTION_ACTIVE);
  } catch (error) {
    console.warn('removeForegroundService failed:', error);
  }
}

/**
 * Fires `onShake` after `SHAKE_COUNT_REQUIRED` above-threshold accelerometer
 * readings inside `SHAKE_WINDOW_MS`. Pass a `useCallback`-stable `onShake`.
 * The subscription only exists while `enabled` is true, and on Android is
 * paired with a foreground-service-style notification for that same window,
 * so the OS doesn't deprioritise the listener while the app is backgrounded.
 */
export function useShakeDetection(onShake: () => void, enabled: boolean): void {
  const shakeTimestampsRef = useRef<number[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (!enabled) return;

    shakeTimestampsRef.current = [];
    Accelerometer.setUpdateInterval(APP_CONFIG.SHAKE_SAMPLE_INTERVAL_MS);
    void registerForegroundService(
      t('emergency.foregroundServiceTitle'),
      t('emergency.foregroundServiceBody'),
    );

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
      void removeForegroundService();
    };
  }, [enabled, onShake, t]);
}
