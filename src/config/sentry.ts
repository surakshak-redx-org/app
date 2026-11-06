import * as Sentry from '@sentry/react-native';

import { ENV, IS_TELEMETRY_ENABLED } from '@/config/env';
import { SENTRY_TRACES_SAMPLE_RATE_BY_ENV } from '@/constants/config';
import { type LogDomain, metroLogger } from '@/utils/logger.utils';
import { sanitizeDiagnostics } from '@/utils/redaction.utils';

export interface CaptureContext {
  domain?: LogDomain;
  operation?: string;
  extra?: Record<string, unknown>;
}

export interface BreadcrumbContext {
  domain?: LogDomain;
  /** Counts, ids and outcomes only -- never phone numbers or coordinates. */
  data?: Record<string, unknown>;
}

type NavigationIntegration = ReturnType<typeof Sentry.reactNavigationIntegration>;

/** Created in `initSentry`; stays null when telemetry is off (APP_ENV=dev). */
let navigationIntegration: NavigationIntegration | null = null;

/**
 * Phone numbers are the single most sensitive field Surakshak handles — an SOS
 * payload carries the user's number and every emergency contact's. Strip
 * anything number-shaped before it leaves the device.
 */
export function scrubPhoneNumbers(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  return sanitizeDiagnostics(event) as Sentry.ErrorEvent;
}

/** Transactions carry span descriptions and URLs, so they get the same scrub. */
export function scrubTransaction(event: Sentry.TransactionEvent): Sentry.TransactionEvent {
  return sanitizeDiagnostics(event) as Sentry.TransactionEvent;
}

/**
 * Console output becomes breadcrumbs automatically, and services log things
 * like recipient lists -- scrub them before they can ride along on an event.
 */
export function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  return sanitizeDiagnostics(breadcrumb) as Sentry.Breadcrumb;
}

export function initSentry(): void {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }

  navigationIntegration = Sentry.reactNavigationIntegration();

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.APP_ENV,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE_BY_ENV[ENV.APP_ENV],
    // Slow/frozen frame counts per screen. User-interaction tracing is left off
    // on purpose: it records touched component names, and the disguise
    // calculator's keypad is one of them.
    enableNativeFramesTracking: true,
    integrations: [navigationIntegration],
    beforeSend: scrubPhoneNumbers,
    beforeSendTransaction: scrubTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/**
 * Hands Expo Router's navigation container to Sentry so route changes become
 * navigation transactions. Safe to call before init or with telemetry off.
 */
export function registerNavigationContainer(navigationContainerRef: unknown): void {
  navigationIntegration?.registerNavigationContainer(navigationContainerRef);
}

/**
 * Attributes events to the Firebase UID. Never pass a phone number or name --
 * the UID is already an opaque, non-reversible identifier.
 */
export function setSentryUser(userId: string | null): void {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }
  Sentry.setUser(userId === null ? null : { id: userId });
}

export function setSentryTags(tags: Record<string, string>): void {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }
  Sentry.setTags(tags);
}

/**
 * Trail of what happened before an error. Breadcrumbs are cheap and only sent
 * if an event fires, so prefer these over capturing expected conditions.
 */
export function recordBreadcrumb(message: string, context?: BreadcrumbContext): void {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }
  Sentry.addBreadcrumb({
    category: (context?.domain ?? 'SYSTEM').toLowerCase(),
    message,
    level: 'info',
    ...(context?.data !== undefined ? { data: context.data } : {}),
  });
}

interface SentryCaptureContext {
  tags: { domain: string; operation: string };
  extra?: Record<string, unknown>;
}

/**
 * Maps our `CaptureContext` onto Sentry's capture-context shape so `domain` and
 * `operation` become searchable tags (dashboards/alerts group by them). `extra`
 * is sanitised here as well as in `beforeSend` so it is safe even if that hook
 * is ever bypassed.
 */
function toSentryContext(
  domain: string,
  operation: string,
  extra?: Record<string, unknown>,
): SentryCaptureContext {
  const context: SentryCaptureContext = { tags: { domain, operation } };
  if (extra !== undefined) {
    context.extra = sanitizeDiagnostics(extra) as Record<string, unknown>;
  }
  return context;
}

export function captureException(error: unknown, context?: CaptureContext): void {
  const domain = context?.domain ?? 'SYSTEM';
  const operation = context?.operation ?? 'unhandled';

  if (!IS_TELEMETRY_ENABLED) {
    metroLogger.error('Exception captured in dev mode', {
      domain,
      operation,
      error,
      context: context?.extra,
    });
    return;
  }

  Sentry.captureException(error, toSentryContext(domain, operation, context?.extra));
}

export function captureMessage(message: string, context?: CaptureContext): void {
  const domain = context?.domain ?? 'SYSTEM';
  const operation = context?.operation ?? 'info';

  if (!IS_TELEMETRY_ENABLED) {
    metroLogger.info(message, {
      domain,
      operation,
      context: context?.extra,
    });
    return;
  }

  Sentry.captureMessage(message, toSentryContext(domain, operation, context?.extra));
}
