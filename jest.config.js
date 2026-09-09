/**
 * `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_*` at TRANSFORM time.
 * Setting these in `setupFiles` is too late — they would already be baked in as
 * `undefined`, and `src/config/env.ts` throws on an invalid environment, which
 * would fail every screen smoke test (ErrorBoundary -> sentry -> env).
 * Module scope here runs before any transform and is inherited by workers.
 */
process.env.EXPO_PUBLIC_APP_ENV ??= 'dev';
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??= 'test-maps-key';
process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ??= 'test-onesignal-app-id';
process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ??= 'test-mixpanel-token';
process.env.EXPO_PUBLIC_SENTRY_DSN ??= 'https://test@test.ingest.sentry.io/1';

module.exports = {
  preset: 'jest-expo',
  resolver: '<rootDir>/tests/config/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/i18n/locales/**',
    '!src/config/**',
    // Type-only modules: erased at compile time, so there is no runtime
    // behaviour to cover and they would only dilute the real numbers.
    '!src/types/**',
  ],
  coverageThreshold: {
    global: { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|' +
      'expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|' +
      'react-navigation|@react-navigation/.*|@sentry/.*|' +
      'nativewind|react-native-css-interop|react-native-maps|' +
      '@react-native-firebase/.*|react-native-onesignal|mixpanel-react-native|' +
      'react-native-reanimated|react-native-worklets))',
  ],
};
