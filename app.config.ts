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

// `eas init` / `eas update` can't write into a dynamic config (a .ts file,
// not static JSON) — both print the value instead of setting it themselves,
// which is why this is a hand-committed literal rather than something a CLI
// manages. Real ID for surakshak-redx-org/app; `eas init --force` would mint
// a different project rather than restore this line. One constant, not a
// runtime app value, so it lives here rather than in src/constants/ — @/
// imports do resolve inside app.config.ts (verified), but this identifier
// has nothing to do with the app's runtime behavior that module documents.
const EAS_PROJECT_ID = '720001ee-e12e-4c08-a278-7c22b660d6ea';

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
 * One Firebase config file per APP_ENV per platform, keyed by bundle id.
 *
 * There is still a single Firebase project (surakshak-2869a) behind all three
 * tiers, but each bundle id (com.surakshak.dev / .staging / .app) is registered
 * as its own app in it, so each needs its own google-services.json /
 * GoogleService-Info.plist — the iOS plist in particular is per-bundle and
 * cannot be shared. deploy.yml must supply the matching pair per APP_ENV.
 *
 * Local dev reads the plain file at the repo root (gitignored, placed by
 * hand). `eas build` is different: it runs on a REMOTE worker that never
 * receives a file merely decoded onto the calling CI runner's disk — the
 * only way a file reaches that worker is EAS's own file-type Environment
 * Variables, which resolve through `process.env.<NAME>` to a temp path that
 * exists only on that specific build machine. GOOGLE_SERVICES_ANDROID_FILE /
 * GOOGLE_SERVICES_IOS_FILE hold exactly that; prefer them when present.
 */
const googleServicesAndroidByEnv: Record<AppEnv, string> = {
  dev: './google-services.dev.json',
  staging: './google-services.staging.json',
  prod: './google-services.prod.json',
};
const googleServicesIosByEnv: Record<AppEnv, string> = {
  dev: './GoogleService-Info.dev.plist',
  staging: './GoogleService-Info.staging.plist',
  prod: './GoogleService-Info.prod.plist',
};

const GOOGLE_SERVICES_ANDROID = envString(
  process.env.GOOGLE_SERVICES_ANDROID_FILE,
  googleServicesAndroidByEnv[APP_ENV],
);
const GOOGLE_SERVICES_IOS = envString(
  process.env.GOOGLE_SERVICES_IOS_FILE,
  googleServicesIosByEnv[APP_ENV],
);

/**
 * A fresh clone (or a build with the EAS file variable not yet set) has
 * neither the local file nor the EAS-provided one — pointing `googleServicesFile`
 * at a missing path makes `expo start` / `expo config` throw. Only set the
 * key when the file actually exists. `exactOptionalPropertyTypes` forbids
 * assigning `undefined`, so this has to be a conditional spread, not a ternary.
 */
function googleServicesFile(path: string): { googleServicesFile: string } | Record<string, never> {
  return fs.existsSync(path) ? { googleServicesFile: path } : {};
}

const config: ExpoConfig = {
  name: appNames[APP_ENV],
  slug: 'surakshak',
  // Bumped for the react-native-maps Google Maps plugin wiring below, which
  // links a new iOS CocoaPod and adds AppDelegate init code. `runtimeVersion`
  // is `appVersion`, so a native change needs a new version string or an OTA
  // could ship to an incompatible native shell.
  version: '1.1.1',
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
      // Required by expo-location's background updates foreground service on
      // Android 14+ (the typed permission is mandatory alongside the base one).
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.CALL_PHONE',
      'android.permission.SEND_SMS',
      'android.permission.READ_PHONE_STATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.READ_CONTACTS',
    ],
  },
  ios: {
    bundleIdentifier: bundleIds[APP_ENV],
    supportsTablet: false,
    ...googleServicesFile(GOOGLE_SERVICES_IOS),
    infoPlist: {
      // Suppresses App Store Connect's manual export-compliance prompt on
      // every build. Standard HTTPS/TLS is exempt from this declaration —
      // it only needs to be `true` if the app implements or modifies its
      // own cryptographic algorithms, which nothing here does.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Surakshak needs camera access for evidence recording.',
      NSMicrophoneUsageDescription: 'Surakshak needs microphone for audio recording.',
      NSLocationWhenInUseUsageDescription:
        'Surakshak needs your location to share with emergency contacts.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Surakshak needs background location for safe journey monitoring.',
      NSContactsUsageDescription: 'Surakshak needs contacts access to add emergency contacts.',
      // Lets the live-location task keep receiving fixes while backgrounded.
      UIBackgroundModes: ['location'],
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
    // react-native-maps' own plugin is what actually wires the key into
    // native code — Expo's plain `ios.config.googleMapsApiKey` /
    // `android.config.googleMaps.apiKey` only ever write an inert
    // Info.plist entry that nothing reads. This plugin additionally links
    // the `react-native-maps/Google` CocoaPod and calls
    // `GMSServices.provideAPIKey(...)` in AppDelegate on iOS, and sets the
    // `com.google.android.geo.API_KEY` AndroidManifest meta-data on
    // Android — without it, Google Maps/Places never authenticate on iOS
    // regardless of GCP key restrictions.
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: GOOGLE_MAPS_API_KEY_IOS,
        androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY_ANDROID,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Surakshak needs background location for safe journey monitoring.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    ['expo-camera', { cameraPermission: 'Surakshak needs camera access for evidence recording.' }],
    ['expo-audio', { microphonePermission: 'Surakshak needs microphone for audio recording.' }],
    // iOS pods must link as static *frameworks*, not the CocoaPods default of
    // static libraries: firebase-ios-sdk's Swift pods (FirebaseAuth,
    // FirebaseFirestore, FirebaseStorage, FirebaseCoreInternal) depend on
    // non-modular pods (GoogleUtilities, the *Interop pods) and can't be built
    // as static libraries at all. react-native-maps + Google Maps needs
    // use_frameworks! on iOS too.
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    // With use_frameworks! active, opt Firebase out of SPM (its SPM products
    // collide under static linkage) so it resolves via CocoaPods podspecs...
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    // ...and set $RNFirebaseAsStaticFramework = true, which those podspecs
    // require under use_frameworks! and the RNFirebase plugin doesn't expose.
    './plugins/withReactNativeFirebaseStaticFramework',
    '@react-native-firebase/auth',
    [
      '@sentry/react-native/expo',
      {
        // Two separate Sentry orgs, not one org with two projects — a
        // surakshak-production auth token has zero access to anything in
        // surakshak-staging and vice versa, since Sentry auth tokens are
        // org-scoped. Each org's default project (from the RN setup wizard)
        // is named "react-native".
        organization: APP_ENV === 'prod' ? 'surakshak-production' : 'surakshak-staging',
        project: 'react-native',
      },
    ],
    ['onesignal-expo-plugin', { mode: APP_ENV === 'prod' ? 'production' : 'development' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  // runtimeVersion "appVersion" ties OTA compatibility to the `version`
  // field above: an update only reaches a native build sharing that exact
  // version string. EAS's own recommended default, avoids fingerprint-based
  // runtime versioning's extra complexity. Bump `version` on any native
  // change, or an OTA could ship to an incompatible native shell.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
