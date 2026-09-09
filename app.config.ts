import * as fs from 'node:fs';

import type { ExpoConfig } from 'expo/config';

type AppEnv = 'dev' | 'staging' | 'prod';

/**
 * `process.env` is typed `any` by the Metro/Node ambient declarations. Narrow
 * once, here, so no `any` escapes into the rest of the config. Reads must stay
 * STATIC member access — `babel-preset-expo` only inlines `EXPO_PUBLIC_*` when
 * it can see the property name, never through `process.env[key]`.
 */
function envString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

const APP_ENV = envString(process.env.EXPO_PUBLIC_APP_ENV, 'dev') as AppEnv;

/**
 * Two separate Maps keys, not one: a Google Maps API key can only carry an
 * Android app restriction OR an iOS app restriction, never both at once — see
 * CLAUDE.md's Google Cloud APIs section for the exact restriction steps.
 */
const GOOGLE_MAPS_API_KEY_ANDROID = envString(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID);
const GOOGLE_MAPS_API_KEY_IOS = envString(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS);

const appNames: Record<AppEnv, string> = {
  dev: 'Surakshak-dev',
  staging: 'Surakshak-staging',
  prod: 'Surakshak',
};

const bundleIds: Record<AppEnv, string> = {
  dev: 'com.surakshak.dev',
  staging: 'com.surakshak.staging',
  prod: 'com.surakshak.app',
};

const iconColors: Record<AppEnv, string> = {
  dev: '#FA8C16',
  staging: '#722ED1',
  prod: '#D4380D',
};

/**
 * One Firebase config per platform, shared by every APP_ENV.
 *
 * NOTE: this collapses the per-environment split that CLAUDE.md's Environments
 * table describes — prod now reads the same Firebase project as dev/staging.
 * Deliberate: the project keeps a single GOOGLE_SERVICES secret per platform.
 * To split them again, restore the Record<AppEnv, string> maps here and add
 * per-environment secrets back to deploy.yml.
 */
const GOOGLE_SERVICES_ANDROID = './google-services.json';
const GOOGLE_SERVICES_IOS = './GoogleService-Info.plist';

/**
 * The native Firebase config files are gitignored and decoded from base64 in CI.
 * A fresh clone will not have them, and pointing `googleServicesFile` at a
 * missing path makes `expo start` / `expo config` throw. Only set the key when
 * the file is actually on disk. `exactOptionalPropertyTypes` forbids assigning
 * `undefined`, so this has to be a conditional spread rather than a ternary.
 */
function googleServicesFile(path: string): { googleServicesFile: string } | Record<string, never> {
  return fs.existsSync(path) ? { googleServicesFile: path } : {};
}

const config: ExpoConfig = {
  name: appNames[APP_ENV],
  slug: 'surakshak',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: `surakshak-${APP_ENV}`,
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  android: {
    package: bundleIds[APP_ENV],
    ...googleServicesFile(GOOGLE_SERVICES_ANDROID),
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: iconColors[APP_ENV],
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.CALL_PHONE',
      'android.permission.SEND_SMS',
      'android.permission.READ_PHONE_STATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.READ_CONTACTS',
    ],
    config: {
      googleMaps: { apiKey: GOOGLE_MAPS_API_KEY_ANDROID },
    },
  },
  ios: {
    bundleIdentifier: bundleIds[APP_ENV],
    supportsTablet: false,
    ...googleServicesFile(GOOGLE_SERVICES_IOS),
    config: {
      googleMapsApiKey: GOOGLE_MAPS_API_KEY_IOS,
    },
    infoPlist: {
      NSCameraUsageDescription: 'Surakshak needs camera access for evidence recording.',
      NSMicrophoneUsageDescription: 'Surakshak needs microphone for audio recording.',
      NSLocationWhenInUseUsageDescription:
        'Surakshak needs your location to share with emergency contacts.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Surakshak needs background location for safe journey monitoring.',
      NSContactsUsageDescription: 'Surakshak needs contacts access to add emergency contacts.',
    },
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-font',
    'expo-asset',
    'expo-image',
    'expo-system-ui',
    'expo-splash-screen',
    'expo-notifications',
    'expo-sensors',
    'expo-contacts',
    'expo-image-picker',
    'react-native-maps',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Surakshak needs background location for safe journey monitoring.',
      },
    ],
    ['expo-camera', { cameraPermission: 'Surakshak needs camera access for evidence recording.' }],
    ['expo-audio', { microphonePermission: 'Surakshak needs microphone for audio recording.' }],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      '@sentry/react-native/expo',
      {
        organization: 'surakshak',
        project: APP_ENV === 'prod' ? 'surakshak-production' : 'surakshak-staging',
      },
    ],
    ['onesignal-expo-plugin', { mode: APP_ENV === 'prod' ? 'production' : 'development' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  // `eas init` can't write this back itself — app.config.ts is dynamic
  // (a .ts file, not static JSON), so it prints the value instead. This is
  // the real one for surakshak-redx-org/app; `eas init --force` would
  // generate a different project rather than restore this line.
  extra: {
    eas: { projectId: '720001ee-e12e-4c08-a278-7c22b660d6ea' },
  },
};

export default config;
