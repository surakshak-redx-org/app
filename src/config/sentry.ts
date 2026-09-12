import * as Sentry from '@sentry/react-native';

import { ENV, IS_TELEMETRY_ENABLED } from '@/config/env';

/**
 * Phone numbers are the single most sensitive field Surakshak handles — an SOS
 * payload carries the user's number and every emergency contact's. Strip
 * anything number-shaped before it leaves the device.
 */
export function scrubPhoneNumbers(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const scrubbed = JSON.stringify(event).replace(/\+?[0-9]{10,13}/g, '[PHONE_REDACTED]');
  return JSON.parse(scrubbed) as Sentry.ErrorEvent;
}

export function initSentry(): void {
  if (!IS_TELEMETRY_ENABLED) {
    console.warn('[Sentry] Disabled in dev — errors will not be reported');
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.APP_ENV,
    beforeSend: scrubPhoneNumbers,
  });
}

export function captureException(error: unknown): void {
  if (!IS_TELEMETRY_ENABLED) return;
  Sentry.captureException(error);
}

export function captureMessage(message: string): void {
  if (!IS_TELEMETRY_ENABLED) return;
  Sentry.captureMessage(message);
}
