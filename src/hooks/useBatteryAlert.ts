import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { useEffect } from 'react';

import { captureException } from '@/config/sentry';
import { APP_CONFIG, LOCATION_UNAVAILABLE } from '@/constants/config';
import { STORAGE_FLAG_OFF, STORAGE_KEYS } from '@/constants/storage';
import { trackLowBatteryAlertSent } from '@/services/analytics.service';
import { buildLocationUrl, getCurrentLocation } from '@/services/location.service';
import { recordSMSAlert, sendLowBatteryAlert } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';

const PERCENT = 100;

/**
 * Sends the low-battery SMS at most once per app session. The flag is module
 * scoped so a re-mount of the dashboard does not re-arm it; tests reset it with
 * `jest.resetModules()`.
 */
let alertedThisSession = false;

async function sendAlert(batteryFraction: number): Promise<void> {
  try {
    const { emergencyContacts, profile } = useUserStore.getState();
    if (emergencyContacts.length === 0) return;

    const surakshakUser = useAuthStore.getState().surakshakUser;
    const name = surakshakUser?.name ?? profile?.name ?? 'User';
    const language = surakshakUser?.language ?? profile?.language ?? 'en';

    let locationUrl = LOCATION_UNAVAILABLE;
    try {
      const fix = await getCurrentLocation();
      locationUrl = buildLocationUrl(fix.latitude, fix.longitude);
    } catch (locationError) {
      console.warn('low-battery alert: location unavailable:', locationError);
    }

    const result = await sendLowBatteryAlert(emergencyContacts, locationUrl, name, language);
    await recordSMSAlert({
      type: 'low_battery',
      locationUrl,
      contactsSent: result.sent,
      contactsFailed: result.failed,
    });
    trackLowBatteryAlertSent(Math.round(batteryFraction * PERCENT));
  } catch (error) {
    captureException(error);
  }
}

/** Watches the battery level and fires the low-battery alert on the way down. */
export function useBatteryAlert(): void {
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let listening = true;

    function maybeFire(batteryFraction: number): void {
      if (alertedThisSession) return;
      if (batteryFraction * PERCENT > APP_CONFIG.LOW_BATTERY_THRESHOLD_PERCENT) return;
      alertedThisSession = true;
      void sendAlert(batteryFraction);
    }

    async function start(): Promise<void> {
      const flag = await AsyncStorage.getItem(STORAGE_KEYS.LOW_BATTERY_ENABLED);
      if (flag === STORAGE_FLAG_OFF || !listening) return;

      const level = await Battery.getBatteryLevelAsync();
      maybeFire(level);

      subscription = Battery.addBatteryLevelListener(({ batteryLevel }): void => {
        maybeFire(batteryLevel);
      });
    }

    start().catch((error: unknown) => captureException(error));

    return (): void => {
      listening = false;
      subscription?.remove();
    };
  }, []);
}
