import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { APP_CONFIG } from '@/constants/config';
import { NOTIFICATION_CHANNEL_IDS, NOTIFICATION_IDS } from '@/constants/notifications';
import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { useDisguiseStore } from '@/stores/disguise.store';
import { useSOSStore } from '@/stores/sos.store';

const NOTIFICATION_CHANNEL_NAME = 'Surakshak Protection';

/**
 * Android-only: a low-importance, non-dismissible-looking notification that
 * signals shake detection is running, matching the OS's expectation that a
 * long-lived background listener shows the user it's active. Silent no-op on
 * iOS, which backgrounds this listener anyway once the app is suspended.
 */
async function registerForegroundService(
  title: string,
  body: string,
  channelName: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_IDS.FOREGROUND, {
      name: channelName,
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

/** Not every OEM ships this settings screen; fall back to the app's own settings page. */
async function openBatterySettings(): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn('openBatterySettings failed:', error);
    }
  }
}

/**
 * Fires `onShake` after `SHAKE_COUNT_REQUIRED` above-threshold accelerometer
 * readings inside `SHAKE_WINDOW_MS`. Pass a `useCallback`-stable `onShake`.
 * The subscription only exists while `enabled` is true, and on Android is
 * paired with a foreground-service-style notification for that same window,
 * so the OS doesn't deprioritise the listener while the app is backgrounded.
 */
export function useShakeDetection(onShake: () => void, shakeEnabled: boolean): void {
  // While the Disguise Mode calculator is showing, shake must do nothing: no
  // listener, notification or prompts that could reveal the safety app (BUG-108).
  const isCalculatorShowing = useDisguiseStore(
    (state) => state.isEnabled === true && !state.isUnlockedThisSession,
  );
  // While SOS countdown or dispatch is running, ignore shake events to prevent
  // high-frequency sensor callbacks from flooding the JS bridge and starving the
  // countdown timer / freezing the UI (BUG-143).
  const isSosActive = useSOSStore((state) => state.isActive || state.isSending);
  const enabled = shakeEnabled && !isCalculatorShowing && !isSosActive;
  const shakeTimestampsRef = useRef<number[]>([]);
  const cooldownUntilRef = useRef(0);
  const { t } = useTranslation();
  const [resumeCount, setResumeCount] = useState(0);
  const isDisguised = useDisguiseStore((state) => state.isEnabled !== false);

  // Android can silently stop sensor delivery while the app is locked/backgrounded
  // (Doze, Battery Saver, OEM task killers) — re-subscribe on every return to foreground.
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setResumeCount((count) => count + 1);
    });
    return (): void => appStateSubscription.remove();
  }, [enabled]);

  // The notification below is not a real foreground service, so the OS may still
  // throttle the accelerometer. Tell the user once, instead of failing silently.
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    let cancelled = false;

    async function warnIfUnreliable(): Promise<void> {
      try {
        const available = await Accelerometer.isAvailableAsync();
        const alreadyShown = await AsyncStorage.getItem(STORAGE_KEYS.SHAKE_BATTERY_HINT_SHOWN);
        if (cancelled) return;
        if (!available) {
          Alert.alert(t('emergency.shakeUnavailable'));
          return;
        }
        if (alreadyShown !== null) return;
        await AsyncStorage.setItem(STORAGE_KEYS.SHAKE_BATTERY_HINT_SHOWN, STORAGE_FLAG_ON);
        Alert.alert(t('emergency.shakeBatteryTitle'), t('emergency.shakeBatteryBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('errors.openSettings'),
            onPress: (): void => {
              void openBatterySettings();
            },
          },
        ]);
      } catch (error) {
        console.warn('shake detection availability check failed:', error);
      }
    }

    void warnIfUnreliable();
    return (): void => {
      cancelled = true;
    };
  }, [enabled, t]);

  useEffect(() => {
    if (!enabled) return;

    shakeTimestampsRef.current = [];
    cooldownUntilRef.current = 0;
    Accelerometer.setUpdateInterval(APP_CONFIG.SHAKE_SAMPLE_INTERVAL_MS);
    // In Disguise Mode the tray must not reveal a safety app: use neutral text and
    // channel name. `isEnabled` is null until the stored flag loads — treat that as
    // disguised so nothing sensitive flashes at startup.
    void registerForegroundService(
      isDisguised
        ? t('emergency.disguiseNotificationTitle')
        : t('emergency.foregroundServiceTitle'),
      isDisguised ? t('emergency.disguiseNotificationBody') : t('emergency.foregroundServiceBody'),
      isDisguised ? t('emergency.disguiseChannelName') : NOTIFICATION_CHANNEL_NAME,
    );

    const subscription = Accelerometer.addListener(({ x, y, z }): void => {
      // Early guard if SOS became active before the subscription teardown takes effect.
      if (useSOSStore.getState().isActive || useSOSStore.getState().isSending) return;

      const now = Date.now();
      if (now < cooldownUntilRef.current) return;

      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude <= APP_CONFIG.SHAKE_THRESHOLD) return;

      shakeTimestampsRef.current = [
        ...shakeTimestampsRef.current.filter((at) => now - at < APP_CONFIG.SHAKE_WINDOW_MS),
        now,
      ];

      if (shakeTimestampsRef.current.length >= APP_CONFIG.SHAKE_COUNT_REQUIRED) {
        shakeTimestampsRef.current = [];
        cooldownUntilRef.current = now + APP_CONFIG.SHAKE_WINDOW_MS;
        onShake();
      }
    });

    return (): void => {
      subscription.remove();
      void removeForegroundService();
    };
  }, [enabled, onShake, t, resumeCount, isDisguised]);
}
