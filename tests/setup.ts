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
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(() => Promise.resolve()),
  signInWithPhoneNumber: jest.fn(() => Promise.resolve({ confirm: jest.fn() })),
  deleteUser: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() =>
    Promise.resolve({ exists: () => false, id: 'test-uid', data: () => undefined }),
  ),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  putFile: jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/avatar.jpg')),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

// Native permission modules pulled in transitively by `@/utils/permissions.utils`.
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
}));

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  },
}));

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 19.076, longitude: 72.8777, accuracy: 5 },
      timestamp: 1_700_000_000_000,
    }),
  ),
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
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
