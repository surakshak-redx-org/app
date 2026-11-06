import * as Sentry from '@sentry/react-native';

import {
  captureException,
  initSentry,
  recordBreadcrumb,
  scrubBreadcrumb,
  scrubPhoneNumbers,
  scrubTransaction,
  setSentryTags,
  setSentryUser,
} from '@/config/sentry';

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

describe('scrubBreadcrumb / scrubTransaction', () => {
  it('redacts phone numbers in a console breadcrumb', () => {
    const result = scrubBreadcrumb({
      category: 'console',
      message: 'sending to 9876543210',
      data: { arguments: ['+919876543210'] },
    });
    expect(JSON.stringify(result)).not.toContain('9876543210');
    expect(JSON.stringify(result)).toContain('[PHONE_REDACTED]');
  });

  it('redacts coordinates held under a sensitive key', () => {
    const result = scrubBreadcrumb({ message: 'fix', data: { latitude: 19.07, longitude: 72.87 } });
    expect(result.data).toEqual({ latitude: '[REDACTED]', longitude: '[REDACTED]' });
  });

  it('redacts phone numbers in a transaction name and span data', () => {
    const transaction = {
      type: 'transaction',
      transaction: '/share/9876543210',
      spans: [{ description: 'GET /u/9876543210' }],
    } as unknown as Parameters<typeof scrubTransaction>[0];
    const result = scrubTransaction(transaction);
    expect(JSON.stringify(result)).not.toContain('9876543210');
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

  it('user, tag and breadcrumb helpers are no-ops', () => {
    setSentryUser('uid-1');
    setSentryTags({ language: 'en' });
    recordBreadcrumb('something happened', { domain: 'SOS' });
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.setTags).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
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
    expect(SentryStaging.captureException).toHaveBeenCalledWith(error, {
      tags: { domain: 'SYSTEM', operation: 'unhandled' },
    });
  });

  it('captureException forwards domain/operation as tags and sanitised extras', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentryStaging = require('@/config/sentry') as typeof import('@/config/sentry');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryStaging = require('@sentry/react-native') as typeof import('@sentry/react-native');
    const error = new Error('sms failed');
    sentryStaging.captureException(error, {
      domain: 'SOS',
      operation: 'sendSosSms',
      extra: { recipient: '9876543210', count: 2 },
    });
    expect(SentryStaging.captureException).toHaveBeenCalledWith(error, {
      tags: { domain: 'SOS', operation: 'sendSosSms' },
      extra: { recipient: '[PHONE_REDACTED]', count: 2 },
    });
  });

  it('captureMessage forwards domain/operation as tags', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentryStaging = require('@/config/sentry') as typeof import('@/config/sentry');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryStaging = require('@sentry/react-native') as typeof import('@sentry/react-native');
    sentryStaging.captureMessage('queued offline', { domain: 'SOS', operation: 'queue' });
    expect(SentryStaging.captureMessage).toHaveBeenCalledWith('queued offline', {
      tags: { domain: 'SOS', operation: 'queue' },
    });
  });

  function loadStaging(): {
    sentry: typeof import('@/config/sentry');
    sdk: typeof import('@sentry/react-native');
  } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@/config/sentry') as typeof import('@/config/sentry');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@sentry/react-native') as typeof import('@sentry/react-native');
    return { sentry, sdk };
  }

  it('initSentry enables tracing, the navigation integration and the scrub hooks', () => {
    const { sentry, sdk } = loadStaging();
    sentry.initSentry();
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 1,
        enableNativeFramesTracking: true,
        integrations: [expect.objectContaining({ name: 'ReactNavigation' })],
        beforeSend: sentry.scrubPhoneNumbers,
        beforeSendTransaction: sentry.scrubTransaction,
        beforeBreadcrumb: sentry.scrubBreadcrumb,
      }),
    );
  });

  it('does not turn on user-interaction tracing (the disguise keypad is a touch target)', () => {
    const { sentry, sdk } = loadStaging();
    sentry.initSentry();
    const options = jest.mocked(sdk.init).mock.calls[0]?.[0];
    expect(options?.enableUserInteractionTracing).toBeUndefined();
  });

  it('registerNavigationContainer forwards the ref to the integration after init', () => {
    const { sentry, sdk } = loadStaging();
    sentry.initSentry();
    const integration = jest.mocked(sdk.reactNavigationIntegration).mock.results[0]?.value as {
      registerNavigationContainer: jest.Mock;
    };
    const ref = { current: {} };
    sentry.registerNavigationContainer(ref);
    expect(integration.registerNavigationContainer).toHaveBeenCalledWith(ref);
  });

  it('registerNavigationContainer is safe before init', () => {
    const { sentry } = loadStaging();
    expect(() => sentry.registerNavigationContainer({})).not.toThrow();
  });

  it('setSentryUser sets an id-only user and clears with null', () => {
    const { sentry, sdk } = loadStaging();
    sentry.setSentryUser('uid-1');
    sentry.setSentryUser(null);
    expect(sdk.setUser).toHaveBeenNthCalledWith(1, { id: 'uid-1' });
    expect(sdk.setUser).toHaveBeenNthCalledWith(2, null);
  });

  it('setSentryTags forwards tags', () => {
    const { sentry, sdk } = loadStaging();
    sentry.setSentryTags({ is_guest: 'false', language: 'hi' });
    expect(sdk.setTags).toHaveBeenCalledWith({ is_guest: 'false', language: 'hi' });
  });

  it('recordBreadcrumb categorises by domain and omits data when absent', () => {
    const { sentry, sdk } = loadStaging();
    sentry.recordBreadcrumb('sos triggered', { domain: 'SOS', data: { method: 'button' } });
    sentry.recordBreadcrumb('plain');
    expect(sdk.addBreadcrumb).toHaveBeenNthCalledWith(1, {
      category: 'sos',
      message: 'sos triggered',
      level: 'info',
      data: { method: 'button' },
    });
    expect(sdk.addBreadcrumb).toHaveBeenNthCalledWith(2, {
      category: 'system',
      message: 'plain',
      level: 'info',
    });
  });
});
