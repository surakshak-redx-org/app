// `jest.resetModules` + `doMock` give each test a fresh copy of the config module
// (and so fresh pending-property state) and a controllable Mixpanel fake. Modules
// are required after the mocks are registered, which a hoisted import cannot do.

type MixpanelConfig = typeof import('@/config/mixpanel');

interface FakeMixpanel {
  init: jest.Mock;
  track: jest.Mock;
  identify: jest.Mock;
  reset: jest.Mock;
  registerSuperProperties: jest.Mock;
  getPeople: jest.Mock;
}

interface Loaded {
  config: MixpanelConfig;
  instance: () => FakeMixpanel;
  peopleSet: jest.Mock;
}

function load(telemetryEnabled: boolean, initFails = false): Loaded {
  jest.resetModules();
  const peopleSet = jest.fn();
  const instances: FakeMixpanel[] = [];

  jest.doMock('@/config/env', () => ({
    ENV: { APP_ENV: 'staging', MIXPANEL_TOKEN: 'mp-token' },
    IS_TELEMETRY_ENABLED: telemetryEnabled,
  }));
  jest.doMock('mixpanel-react-native', () => ({
    Mixpanel: jest.fn().mockImplementation(() => {
      const fake: FakeMixpanel = {
        init: jest.fn(() =>
          initFails ? Promise.reject(new Error('native failure')) : Promise.resolve(),
        ),
        track: jest.fn(),
        identify: jest.fn(() => Promise.resolve()),
        reset: jest.fn(),
        registerSuperProperties: jest.fn(),
        getPeople: jest.fn(() => ({ set: peopleSet })),
      };
      instances.push(fake);
      return fake;
    }),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require('@/config/mixpanel') as MixpanelConfig;
  return {
    config,
    instance: (): FakeMixpanel => {
      const [first] = instances;
      if (first === undefined) throw new Error('Mixpanel was never constructed');
      return first;
    },
    peopleSet,
  };
}

describe('mixpanel super and people properties', () => {
  afterEach(() => {
    jest.dontMock('@/config/env');
    jest.dontMock('mixpanel-react-native');
  });

  it('applies properties set before init finished, once it does', async () => {
    const { config, instance, peopleSet } = load(true);
    config.setSuperProperties({ app_version: '1.4.2', is_guest: false });
    config.setPeopleProperties({ platform: 'android' });

    await config.initMixPanel();

    expect(instance().registerSuperProperties).toHaveBeenCalledWith({
      app_version: '1.4.2',
      is_guest: false,
    });
    expect(peopleSet).toHaveBeenCalledWith({ platform: 'android' });
  });

  it('sends properties straight away once initialised, merged over earlier ones', async () => {
    const { config, instance } = load(true);
    await config.initMixPanel();

    config.setSuperProperties({ language: 'en', is_guest: false });
    config.setSuperProperties({ language: 'hi' });

    expect(instance().registerSuperProperties).toHaveBeenLastCalledWith({
      language: 'hi',
      is_guest: false,
    });
  });

  it('re-sends people properties after identify so they land on the identified profile', async () => {
    const { config, instance, peopleSet } = load(true);
    await config.initMixPanel();
    config.setPeopleProperties({ language: 'hi' });
    peopleSet.mockClear();

    config.identify('uid-1');

    expect(instance().identify).toHaveBeenCalledWith('uid-1');
    expect(peopleSet).toHaveBeenCalledWith({ language: 'hi' });
  });

  it('restores super properties after reset, which would otherwise wipe them', async () => {
    const { config, instance } = load(true);
    await config.initMixPanel();
    config.setSuperProperties({ app_version: '1.4.2' });
    instance().registerSuperProperties.mockClear();

    config.resetAnalytics();

    expect(instance().reset).toHaveBeenCalledTimes(1);
    expect(instance().registerSuperProperties).toHaveBeenCalledWith({ app_version: '1.4.2' });
  });

  it('does nothing when telemetry is off (APP_ENV=dev)', async () => {
    const { config, peopleSet } = load(false);
    config.setSuperProperties({ app_version: '1.4.2' });
    config.setPeopleProperties({ platform: 'android' });
    await config.initMixPanel();
    config.identify('uid-1');
    config.resetAnalytics();

    expect(peopleSet).not.toHaveBeenCalled();
    expect(() => config.track('sos_triggered')).not.toThrow();
  });

  it('keeps accepting properties, harmlessly, if init failed', async () => {
    const { config, instance } = load(true, true);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await config.initMixPanel();
    expect(() => config.setSuperProperties({ language: 'en' })).not.toThrow();
    // init failed, so the instance was never adopted and nothing is sent to it.
    expect(instance().registerSuperProperties).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
