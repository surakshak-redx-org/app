import * as Sentry from '@sentry/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/global.css';
import '@/i18n';

import { Spinner } from '@/components/ui/Spinner';
import { initMixPanel } from '@/config/mixpanel';
import { initOneSignal } from '@/config/onesignal';
import { initSentry } from '@/config/sentry';
import { ROUTES } from '@/constants/routes';
import { subscribeToAuthChanges } from '@/services/firebase/auth.service';
import { useAuthStore } from '@/stores/auth.store';

const AUTH_SEGMENT = '(auth)';

function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setUser = useAuthStore((state) => state.setUser);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  // Third-party SDKs. Each one no-ops or warns when APP_ENV is dev.
  useEffect(() => {
    initSentry();
    initOneSignal();
    void initMixPanel();
  }, []);

  // Firebase auth is reached through the service layer — absolute rule 13
  // forbids a screen (this file included) from touching Firebase directly.
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((firebaseUser) => {
      setUser(firebaseUser);
      setInitialized(true);
    });

    return unsubscribe;
  }, [setUser, setInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const isSignedIn = user !== null || isGuest;
    const isInAuthGroup = segments[0] === AUTH_SEGMENT;

    if (!isSignedIn && !isInAuthGroup) {
      router.replace(ROUTES.WELCOME);
    } else if (isSignedIn && isInAuthGroup) {
      router.replace(ROUTES.HOME);
    }
  }, [isInitialized, user, isGuest, segments, router]);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        {isInitialized ? (
          <Slot />
        ) : (
          <Spinner size="lg" className="flex-1 items-center justify-center" />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
