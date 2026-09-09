/**
 * Global Jest setup. Native modules have no JS implementation under Jest, so
 * every package backed by native code is mocked here rather than in each test.
 *
 * Environment variables are NOT set here — `babel-preset-expo` inlines
 * `EXPO_PUBLIC_*` at transform time, which happens before this file runs. They
 * are set at module scope in `jest.config.js` instead.
 *
 * The i18n import runs the real translation stack rather than stubbing `t` to
 * echo its key, so a typo'd translation key fails a screen test instead of
 * silently passing. `jest.mock` calls are hoisted above it by babel-jest, so
 * the mocks below still apply.
 */
import '@/i18n';

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
}));

jest.mock('react-native-onesignal', () => ({
  OneSignal: {
    initialize: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    Notifications: { requestPermission: jest.fn(() => Promise.resolve(true)) },
  },
}));

jest.mock('mixpanel-react-native', () => ({
  Mixpanel: jest.fn().mockImplementation(() => ({
    init: jest.fn(() => Promise.resolve()),
    track: jest.fn(),
    identify: jest.fn(() => Promise.resolve()),
    reset: jest.fn(),
  })),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', languageTag: 'en-IN' }]),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: 'warning', Success: 'success', Error: 'error' },
}));
