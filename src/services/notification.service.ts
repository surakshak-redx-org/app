/**
 * Local, on-device notifications only. Remote push is OneSignal's job — see
 * `src/config/onesignal.ts`. Keeping them separate avoids the two libraries
 * fighting over the FCM/APNs delegate.
 */

/**
 * Schedules a local notification after a delay.
 * @phase Phase 7 — Advanced Safety
 */
export function scheduleLocalNotification(
  _title: string,
  _body: string,
  _delaySeconds: number,
): Promise<string> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Cancels a previously scheduled local notification.
 * @phase Phase 7 — Advanced Safety
 */
export function cancelLocalNotification(_notificationId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Registers the signed-in user with OneSignal so pushes can target them.
 * @phase Phase 3 — Emergency Core
 */
export function registerForPushNotifications(_userId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}
