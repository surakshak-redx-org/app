import { OneSignal } from 'react-native-onesignal';

import { ENV } from '@/config/env';

/**
 * OneSignal owns remote push on every environment (dev included — dev builds
 * register against the OneSignal development app). `expo-notifications` is used
 * only for local, on-device notifications so the two never fight over the
 * FCM/APNs delegate.
 */
export function initOneSignal(): void {
  OneSignal.initialize(ENV.ONESIGNAL_APP_ID);
  void OneSignal.Notifications.requestPermission(true);
}

export function setExternalUserId(userId: string): void {
  OneSignal.login(userId);
}

export function clearExternalUserId(): void {
  OneSignal.logout();
}
