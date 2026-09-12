import * as Notifications from 'expo-notifications';

import { setExternalUserId } from '@/config/onesignal';

/**
 * Local, on-device notifications only. Remote push is OneSignal's job — see
 * `src/config/onesignal.ts`. Keeping them separate avoids the two libraries
 * fighting over the FCM/APNs delegate.
 */

/**
 * Schedules a local notification after a delay. `data` lets a listener (see
 * `app/_layout.tsx`) tell notification types apart without parsing the body.
 * @phase Phase 7 — Advanced Safety
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds: number,
  data?: Record<string, unknown>,
): Promise<string> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {} },
      trigger:
        delaySeconds <= 0
          ? null
          : {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delaySeconds,
            },
    });
  } catch (error) {
    console.error('scheduleLocalNotification failed:', error);
    throw error;
  }
}

/**
 * Cancels a previously scheduled local notification.
 * @phase Phase 7 — Advanced Safety
 */
export async function cancelLocalNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('cancelLocalNotification failed:', error);
    throw error;
  }
}

/**
 * Registers the signed-in user with OneSignal so pushes can target them —
 * called from the auth-sync effect in `app/_layout.tsx` alongside
 * `identifyUser` (MixPanel). `setExternalUserId` itself is synchronous
 * (`OneSignal.login` fires-and-forgets over its own SDK), so this only
 * exists to give the call a consistent async service-layer signature and a
 * single place to catch a failure.
 */
export function registerForPushNotifications(userId: string): Promise<void> {
  try {
    setExternalUserId(userId);
    return Promise.resolve();
  } catch (error) {
    console.error('registerForPushNotifications failed:', error);
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}
