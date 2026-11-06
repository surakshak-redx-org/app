import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ENV } from '@/config/env';
import { FALLBACK_APP_VERSION } from '@/constants/auth';
import {
  setAnalyticsSuperProperties,
  setAnalyticsUserProperties,
} from '@/services/analytics.service';
import { useAuthStore } from '@/stores/auth.store';

const APP_VERSION = Constants.expoConfig?.version ?? FALLBACK_APP_VERSION;

/**
 * Gives every Mixpanel event, and the user's profile, the dimensions needed to
 * slice a funnel: environment, app version, platform, language and guest status.
 *
 * Without these, "which version broke OTP?" or "do Hindi users drop off at
 * onboarding?" cannot be answered from the data. Derived from the stores so the
 * values follow sign-out, guest conversion and language changes on their own.
 * Nothing identifying (name, phone, location) is ever set here.
 */
export function useAnalyticsContext(): void {
  const isGuest = useAuthStore((state) => state.isGuest);
  const language = useAuthStore((state) => state.surakshakUser?.language);

  useEffect(() => {
    const device = { app_env: ENV.APP_ENV, app_version: APP_VERSION, platform: Platform.OS };
    setAnalyticsSuperProperties(device);
    setAnalyticsUserProperties({ app_version: APP_VERSION, platform: Platform.OS });
  }, []);

  useEffect(() => {
    const dynamic = { is_guest: isGuest, ...(language !== undefined ? { language } : {}) };
    setAnalyticsSuperProperties(dynamic);
    setAnalyticsUserProperties(dynamic);
  }, [isGuest, language]);
}
