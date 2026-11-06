// Jest always runs with EXPO_PUBLIC_APP_ENV=dev, so telemetry is off unless a
// test swaps `@/config/env`. `jest.resetModules` gives each test a fresh copy of
// every module (and of the mocks in tests/setup.ts), so they are re-required
// after `doMock` -- a hoisted import could not see the mocked env.

type MixpanelConfig = typeof import('@/config/mixpanel');
type ReplayModule = typeof import('@mixpanel/react-native-session-replay');
type StorageModule = typeof import('@react-native-async-storage/async-storage');

interface Loaded {
  mixpanel: MixpanelConfig;
  replay: ReplayModule;
  storage: StorageModule['default'];
  mixpanelSdk: typeof import('mixpanel-react-native');
}

function load(appEnv: 'dev' | 'staging' | 'prod', telemetryEnabled: boolean): Loaded {
  jest.resetModules();
  jest.doMock('@/config/env', () => ({
    ENV: { APP_ENV: appEnv, MIXPANEL_TOKEN: 'mp-token' },
    IS_TELEMETRY_ENABLED: telemetryEnabled,
  }));
  /* eslint-disable @typescript-eslint/no-require-imports */
  return {
    mixpanel: require('@/config/mixpanel') as MixpanelConfig,
    replay: require('@mixpanel/react-native-session-replay') as ReplayModule,
    storage: (require('@react-native-async-storage/async-storage') as StorageModule).default,
    mixpanelSdk: require('mixpanel-react-native') as typeof import('mixpanel-react-native'),
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
}

function lastMixpanelInstance(sdk: Loaded['mixpanelSdk']): {
  track: jest.Mock;
  identify: jest.Mock;
} {
  const results = jest.mocked(sdk.Mixpanel).mock.results;
  return results[results.length - 1]?.value as { track: jest.Mock; identify: jest.Mock };
}

describe('mixpanel config', () => {
  afterEach(() => {
    jest.dontMock('@/config/env');
  });

  describe('telemetry off (APP_ENV=dev)', () => {
    it('initialises neither analytics nor replay', async () => {
      const { mixpanel, replay, mixpanelSdk } = load('dev', false);
      await mixpanel.initMixPanel();
      expect(mixpanelSdk.Mixpanel).not.toHaveBeenCalled();
      expect(replay.MPSessionReplay.initialize).not.toHaveBeenCalled();
    });

    it('setSessionReplayRecording is a no-op', async () => {
      const { mixpanel, replay } = load('dev', false);
      await mixpanel.setSessionReplayRecording(true);
      await mixpanel.setSessionReplayRecording(false);
      expect(replay.MPSessionReplay.startRecording).not.toHaveBeenCalled();
      expect(replay.MPSessionReplay.stopRecording).not.toHaveBeenCalled();
    });
  });

  describe('telemetry on (APP_ENV=staging)', () => {
    it('starts replay with the Mixpanel distinct id, Wi-Fi only, and everything masked', async () => {
      const { mixpanel, replay } = load('staging', true);
      await mixpanel.initMixPanel();

      expect(replay.MPSessionReplay.initialize).toHaveBeenCalledWith(
        'mp-token',
        'distinct-1',
        expect.objectContaining({
          wifiOnly: true,
          recordingSessionsPercent: 100,
          autoStartRecording: true,
          autoMaskedViews: ['text', 'image', 'web', 'map'],
        }),
      );
    });

    it('samples production at 10 percent', async () => {
      const { mixpanel, replay } = load('prod', true);
      await mixpanel.initMixPanel();

      expect(replay.MPSessionReplay.initialize).toHaveBeenCalledWith(
        'mp-token',
        'distinct-1',
        expect.objectContaining({ recordingSessionsPercent: 10 }),
      );
    });

    it('does not auto-start recording for a user who opted out', async () => {
      const { mixpanel, replay, storage } = load('staging', true);
      jest.mocked(storage.getItem).mockResolvedValueOnce('true');
      await mixpanel.initMixPanel();

      expect(replay.MPSessionReplay.initialize).toHaveBeenCalledWith(
        'mp-token',
        'distinct-1',
        expect.objectContaining({ autoStartRecording: false }),
      );
    });

    it('does not auto-start recording when the preference cannot be read (fail closed)', async () => {
      const { mixpanel, replay, storage } = load('staging', true);
      jest.mocked(storage.getItem).mockRejectedValueOnce(new Error('disk'));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await mixpanel.initMixPanel();
      warn.mockRestore();

      expect(replay.MPSessionReplay.initialize).toHaveBeenCalledWith(
        'mp-token',
        'distinct-1',
        expect.objectContaining({ autoStartRecording: false }),
      );
    });

    it('keeps analytics working when replay fails to start', async () => {
      const { mixpanel, replay, mixpanelSdk } = load('staging', true);
      jest.mocked(replay.MPSessionReplay.initialize).mockRejectedValueOnce(new Error('no module'));
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await mixpanel.initMixPanel();
      error.mockRestore();

      mixpanel.track('sos_triggered', { method: 'button' });
      expect(lastMixpanelInstance(mixpanelSdk).track).toHaveBeenCalledWith('sos_triggered', {
        method: 'button',
      });
    });

    it('forwards identify to replay so recordings attach to the person', async () => {
      const { mixpanel, replay, mixpanelSdk } = load('staging', true);
      await mixpanel.initMixPanel();
      mixpanel.identify('uid-1');

      expect(lastMixpanelInstance(mixpanelSdk).identify).toHaveBeenCalledWith('uid-1');
      expect(replay.MPSessionReplay.identify).toHaveBeenCalledWith('uid-1');
    });

    it('does not call replay identify when replay never started', async () => {
      const { mixpanel, replay } = load('staging', true);
      jest.mocked(replay.MPSessionReplay.initialize).mockRejectedValueOnce(new Error('no module'));
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await mixpanel.initMixPanel();
      error.mockRestore();
      mixpanel.identify('uid-1');

      expect(replay.MPSessionReplay.identify).not.toHaveBeenCalled();
    });

    it('setSessionReplayRecording stops and resumes recording immediately', async () => {
      const { mixpanel, replay } = load('staging', true);
      await mixpanel.initMixPanel();

      await mixpanel.setSessionReplayRecording(false);
      expect(replay.MPSessionReplay.stopRecording).toHaveBeenCalledTimes(1);

      await mixpanel.setSessionReplayRecording(true);
      expect(replay.MPSessionReplay.startRecording).toHaveBeenCalledWith(100);
    });

    it('setSessionReplayRecording does nothing before replay has started', async () => {
      const { mixpanel, replay } = load('staging', true);
      await mixpanel.setSessionReplayRecording(false);
      expect(replay.MPSessionReplay.stopRecording).not.toHaveBeenCalled();
    });

    it('setSessionReplayRecording swallows a native failure', async () => {
      const { mixpanel, replay } = load('staging', true);
      await mixpanel.initMixPanel();
      jest.mocked(replay.MPSessionReplay.stopRecording).mockRejectedValueOnce(new Error('boom'));
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(mixpanel.setSessionReplayRecording(false)).resolves.toBeUndefined();
      error.mockRestore();
    });
  });
});
