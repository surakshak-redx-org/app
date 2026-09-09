import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';

/**
 * `@react-native-firebase` auto-initialises the default app from the native
 * config files bundled at build time (`google-services.json` on Android,
 * `GoogleService-Info.plist` on iOS), so there is nothing to configure here —
 * which project you get is decided by `app.config.ts` from APP_ENV.
 */
const app = getApp();

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
