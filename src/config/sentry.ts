import * as Sentry from '@sentry/react-native';

import { ENV, IS_TELEMETRY_ENABLED } from '@/config/env';
import {
  SENTRY_REPLAY_ERROR_SAMPLE_RATE_BY_ENV,
  SENTRY_REPLAY_SESSION_SAMPLE_RATE_BY_ENV,
  SENTRY_TRACES_SAMPLE_RATE_BY_ENV,
} from '@/constants/config';
import { type LogDomain, metroLogger } from '@/utils/logger.utils';
import { sanitizeDiagnostics } from '@/utils/redaction.utils';
import { isReplayOptedOut } from '@/utils/replay-consent.utils';

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

/** Set once `Sentry.init` has run; stays null when telemetry is off (APP_ENV=dev). */
let navigationIntegration: NavigationIntegration | null = null;

/**
 * The root layout hands over its navigation ref as soon as it mounts, but init
 * now waits on a storage read first. Remember the ref so registration happens
 * whichever of the two finishes first.
 */
let pendingNavigationContainer: unknown = null;

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

export async function initSentry(): Promise<void> {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }

  try {
    // Read before init because replay sample rates are fixed once Sentry starts
    // (SDK 7.11 has no runtime pause/stop). Opting out therefore applies from the
    // next launch. A failed read counts as opted out -- see `isReplayOptedOut`.
    const replayOptedOut = await isReplayOptedOut();
    const integration = Sentry.reactNavigationIntegration();

    Sentry.init({
      dsn: ENV.SENTRY_DSN,
      environment: ENV.APP_ENV,
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE_BY_ENV[ENV.APP_ENV],
      // Slow/frozen frame counts per screen. User-interaction tracing is left off
      // on purpose: it records touched component names, and the disguise
      // calculator's keypad is one of them.
      enableNativeFramesTracking: true,
      replaysSessionSampleRate: replayOptedOut
        ? 0
        : SENTRY_REPLAY_SESSION_SAMPLE_RATE_BY_ENV[ENV.APP_ENV],
      replaysOnErrorSampleRate: replayOptedOut
        ? 0
        : SENTRY_REPLAY_ERROR_SAMPLE_RATE_BY_ENV[ENV.APP_ENV],
      integrations: replayOptedOut ? [integration] : [integration, buildReplayIntegration()],
      beforeSend: scrubPhoneNumbers,
      beforeSendTransaction: scrubTransaction,
      beforeBreadcrumb: scrubBreadcrumb,
    });

    navigationIntegration = integration;
    if (pendingNavigationContainer !== null) {
      integration.registerNavigationContainer(pendingNavigationContainer);
    }
  } catch (error) {
    // Sentry is not up, so there is nowhere to report this -- log and carry on.
    console.error('initSentry failed:', error);
  }
}

/**
 * Replay for a women's-safety app: everything is masked, and the Android
 * `canvas` strategy is used because it masks all text, inputs and images
 * regardless of other settings (the default `pixelCopy` can misalign masks and
 * briefly expose text). Screens that reveal location or contacts are blocked
 * outright with `ReplayBlock`.
 */
function buildReplayIntegration(): ReturnType<typeof Sentry.mobileReplayIntegration> {
  return Sentry.mobileReplayIntegration({
    maskAllText: true,
    maskAllImages: true,
    maskAllVectors: true,
    screenshotStrategy: 'canvas',
  });
}

/**
 * Hands Expo Router's navigation container to Sentry so route changes become
 * navigation transactions. Safe to call before init or with telemetry off.
 */
export function registerNavigationContainer(navigationContainerRef: unknown): void {
  pendingNavigationContainer = navigationContainerRef;
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
