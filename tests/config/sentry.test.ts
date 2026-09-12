import * as Sentry from '@sentry/react-native';

import { captureException, initSentry, scrubPhoneNumbers } from '@/config/sentry';

function event(extra: Record<string, unknown>): Sentry.ErrorEvent {
  return { message: '', ...extra } as Sentry.ErrorEvent;
}

describe('scrubPhoneNumbers', () => {
  it('redacts a bare 10-digit number', () => {
    const result = scrubPhoneNumbers(event({ message: 'call 9876543210 now' }));
    expect(JSON.stringify(result)).toContain('[PHONE_REDACTED]');
    expect(JSON.stringify(result)).not.toContain('9876543210');
  });

  it('redacts a +91-prefixed number', () => {
    const result = scrubPhoneNumbers(event({ message: 'contact +919876543210' }));
    expect(JSON.stringify(result)).toContain('[PHONE_REDACTED]');
    expect(JSON.stringify(result)).not.toContain('+919876543210');
  });

  it('redacts a number embedded inside a larger string', () => {
    const result = scrubPhoneNumbers(event({ message: 'phone: 9876543210, other data' }));
    expect(JSON.stringify(result)).toBe(
      JSON.stringify(event({ message: 'phone: [PHONE_REDACTED], other data' })),
    );
  });

  it('does not redact a 6-digit OTP', () => {
    const result = scrubPhoneNumbers(event({ message: 'otp 100001 entered' }));
    expect(JSON.stringify(result)).toContain('100001');
  });

  it('does not redact 3-digit emergency numbers', () => {
    const result = scrubPhoneNumbers(event({ message: 'dialled 112 and 100 and 108' }));
    expect(JSON.stringify(result)).toContain('112');
    expect(JSON.stringify(result)).toContain('100');
    expect(JSON.stringify(result)).toContain('108');
  });
});

// Jest always runs with EXPO_PUBLIC_APP_ENV=dev (see jest.config.js), so
// `IS_TELEMETRY_ENABLED` is false unless a test overrides `@/config/env`.
describe('telemetry gating (APP_ENV=dev, the real Jest environment)', () => {
  it('initSentry does not call Sentry.init', () => {
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('captureException is a no-op', () => {
    captureException(new Error('should not report'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('telemetry gating (APP_ENV=staging, simulated)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/config/env', () => ({
      ENV: { APP_ENV: 'staging', SENTRY_DSN: 'https://example.test/1' },
      IS_TELEMETRY_ENABLED: true,
    }));
  });

  afterEach(() => {
    jest.dontMock('@/config/env');
  });

  it('initSentry calls Sentry.init', () => {
    // `resetModules` gives `@sentry/react-native`'s own mock factory (from
    // tests/setup.ts) a fresh instance too — re-require it here to assert on
    // the same instance `@/config/sentry` actually calls into. `require`
    // (not a static import) is required precisely because this needs to run
    // *after* `resetModules`/`doMock` above, at a point a hoisted import
    // can't reach — rule 3 (no eslint-disable) is scoped to src/ and app/
    // for exactly this kind of test-only escape hatch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentryStaging = require('@/config/sentry') as typeof import('@/config/sentry');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryStaging = require('@sentry/react-native') as typeof import('@sentry/react-native');
    sentryStaging.initSentry();
    expect(SentryStaging.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://example.test/1', environment: 'staging' }),
    );
  });

  it('captureException reports to Sentry', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentryStaging = require('@/config/sentry') as typeof import('@/config/sentry');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryStaging = require('@sentry/react-native') as typeof import('@sentry/react-native');
    const error = new Error('boom');
    sentryStaging.captureException(error);
    expect(SentryStaging.captureException).toHaveBeenCalledWith(error);
  });
});
