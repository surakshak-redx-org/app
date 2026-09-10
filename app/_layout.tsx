import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/global.css';

import { Spinner } from '@/components/ui/Spinner';
import { initMixPanel } from '@/config/mixpanel';
import { initOneSignal } from '@/config/onesignal';
import { captureException, initSentry } from '@/config/sentry';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storage';
import { registerLiveLocationTask } from '@/hooks/useLiveLocation';
import { changeLanguage } from '@/i18n';
import { identifyUser } from '@/services/analytics.service';
import { subscribeToAuthChanges } from '@/services/firebase/auth.service';
import { getUserProfile } from '@/services/firebase/user.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';

const AUTH_SEGMENT = '(auth)';
const ONBOARDING_SEGMENT = 'onboarding';

function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setUser = useAuthStore((state) => state.setUser);
  const setGuest = useAuthStore((state) => state.setGuest);
  const setSurakshakUser = useAuthStore((state) => state.setSurakshakUser);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const setProfileMirror = useUserStore((state) => state.setProfile);

  // Third-party SDKs. Each one no-ops or warns when APP_ENV is dev.
  useEffect(() => {
    initSentry();
    initOneSignal();
    void initMixPanel();
  }, []);

  // The background location task must be defined before the first tick so the
  // OS can hand a relaunch back to it — see `useLiveLocation`.
  useEffect(() => {
    registerLiveLocationTask();
  }, []);

  // Firebase auth is reached through the service layer — absolute rule 13
  // forbids a screen (this file included) from touching Firebase directly.
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((firebaseUser) => {
      async function sync(): Promise<void> {
        try {
          if (firebaseUser !== null) {
            setUser(firebaseUser);
            setGuest(false);

            const profile = await getUserProfile(firebaseUser.uid);
            if (profile !== null) {
              setSurakshakUser(profile);
              setProfileMirror(profile);
              identifyUser(firebaseUser.uid);
              await changeLanguage(profile.language);
            }

            const onboardingDone = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
            if (profile === null && onboardingDone === null) {
              router.replace(ROUTES.ONBOARDING);
            }
          } else if (!useAuthStore.getState().isGuest) {
            setUser(null);
            setSurakshakUser(null);
          }
        } catch (error) {
          captureException(error);
        } finally {
          setInitialized(true);
        }
      }

      void sync();
    });

    return unsubscribe;
  }, [router, setUser, setGuest, setSurakshakUser, setProfileMirror, setInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const isSignedIn = user !== null || isGuest;
    const isInAuthGroup = segments[0] === AUTH_SEGMENT;
    const isOnboarding = segments.some((segment) => segment === ONBOARDING_SEGMENT);

    if (!isSignedIn && !isInAuthGroup) {
      router.replace(ROUTES.WELCOME);
    } else if (isSignedIn && isInAuthGroup && !isOnboarding) {
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
