import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-devanagari';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/global.css';

import { Spinner } from '@/components/ui/Spinner';
import { initMixPanel } from '@/config/mixpanel';
import { initOneSignal } from '@/config/onesignal';
import { captureException, initSentry } from '@/config/sentry';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { registerLiveLocationTask } from '@/hooks/useLiveLocation';
import { changeLanguage } from '@/i18n';
import { identifyUser } from '@/services/analytics.service';
import { subscribeToAuthChanges } from '@/services/firebase/auth.service';
import { getUserProfile } from '@/services/firebase/user.service';
import { useAuthStore } from '@/stores/auth.store';
import { useDisguiseStore } from '@/stores/disguise.store';
import { useSOSStore } from '@/stores/sos.store';
import { useUserStore } from '@/stores/user.store';

const AUTH_SEGMENT = '(auth)';
const ONBOARDING_SEGMENT = 'onboarding';
const DISGUISE_SEGMENT = '(disguise)';

function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();

  // Android has no guaranteed system Devanagari face on every OEM/OS build —
  // load Noto Sans Devanagari so hi/mr text never renders as boxes/tofu.
  // iOS's system font already covers Devanagari, but useFonts still resolves
  // (near-)instantly there since it isn't rendering the glyphs itself.
  const [fontsLoaded] = useFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });

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

  // Disguise Mode: hide the real app behind a working calculator until the
  // correct PIN is entered there. Checked once isInitialized so it never
  // races the auth-redirect effect above, and skipped if already showing the
  // calculator so a PIN-unlock navigation isn't immediately bounced back.
  // `DISGUISE_ENABLED` in AsyncStorage stays on across app restarts (so it
  // re-arms on the next cold start), so once the PIN has been entered this
  // session we also check the in-memory unlock flag — otherwise this effect
  // re-fires on every post-unlock navigation and bounces straight back to
  // the calculator.
  const isDisguiseUnlocked = useDisguiseStore((state) => state.isUnlockedThisSession);
  useEffect(() => {
    if (!isInitialized) return;
    if (segments[0] === DISGUISE_SEGMENT) return;
    if (isDisguiseUnlocked) return;

    AsyncStorage.getItem(STORAGE_KEYS.DISGUISE_ENABLED)
      .then((flag) => {
        if (flag === STORAGE_FLAG_ON) router.replace(ROUTES.CALCULATOR);
      })
      .catch((error: unknown) => captureException(error));
  }, [isInitialized, segments, router, isDisguiseUnlocked]);

  // Local notification handlers for Phase 7's background safety features —
  // see `useSuspiciousFollow` and `useSafeCheckin` for where these are fired.
  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data.type as string | undefined;

      if (type === 'suspicious_follow') {
        Alert.alert(t('home.suspiciousFollowTitle'), t('home.suspiciousFollowBody'), [
          {
            text: t('home.triggerSos'),
            style: 'destructive',
            onPress: (): void => useSOSStore.getState().setActive(true, 'suspicious_follow'),
          },
          {
            text: t('location.liveLocation'),
            onPress: (): void => router.push(ROUTES.LIVE_LOCATION),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
      }

      if (type === 'safe_checkin') {
        router.push(ROUTES.SAFE_CHECKIN);
      }
    });

    return (): void => responseSub.remove();
  }, [router, t]);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        {/* Expo SDK 57's edge-to-edge Android default draws content behind a
            transparent status bar; without an explicit style the bar's own
            icon color is left to the OS default, which can render invisible
            against light screen backgrounds. `dark` matches this app's
            off-white/white screens; a full-bleed dark screen (e.g. the
            recording view) can override locally with its own <StatusBar/>. */}
        <StatusBar style="dark" />
        {isInitialized && fontsLoaded ? (
          <Slot />
        ) : (
          <Spinner size="lg" className="flex-1 items-center justify-center" />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
