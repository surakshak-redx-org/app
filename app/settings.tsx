import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storage';
import {
  ANALYTICS_EVENTS,
  resetUser as resetAnalytics,
  trackEvent,
} from '@/services/analytics.service';
import { deleteAccount } from '@/services/firebase/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';

const FALLBACK_VERSION = '1.0.0';
const ROW_ICON_SIZE = 20;

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [lowBatteryEnabled, setLowBatteryEnabled] = useState(true);

  useEffect(() => {
    void AsyncStorage.multiGet([STORAGE_KEYS.SHAKE_ENABLED, STORAGE_KEYS.LOW_BATTERY_ENABLED]).then(
      (entries) => {
        const stored = new Map<string, string | null>(entries);
        setShakeEnabled(stored.get(STORAGE_KEYS.SHAKE_ENABLED) !== 'false');
        setLowBatteryEnabled(stored.get(STORAGE_KEYS.LOW_BATTERY_ENABLED) !== 'false');
      },
    );
  }, []);

  function handleShakeToggle(value: boolean): void {
    setShakeEnabled(value);
    void AsyncStorage.setItem(STORAGE_KEYS.SHAKE_ENABLED, String(value));
  }

  function handleBatteryToggle(value: boolean): void {
    setLowBatteryEnabled(value);
    void AsyncStorage.setItem(STORAGE_KEYS.LOW_BATTERY_ENABLED, String(value));
  }

  async function runDelete(): Promise<void> {
    try {
      await deleteAccount();
      useAuthStore.getState().reset();
      useUserStore.getState().reset();
      resetAnalytics();
      trackEvent(ANALYTICS_EVENTS.ACCOUNT_DELETED, {});
      router.replace(ROUTES.WELCOME);
    } catch (error) {
      captureException(error);
      Alert.alert(t('errors.generic'));
    }
  }

  function handleDeleteAccount(): void {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          Alert.alert(t('settings.deleteAccount'), t('profile.deleteAccountConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.deleteAccountConfirmFinal'),
              style: 'destructive',
              onPress: (): void => void runDelete(),
            },
          ]);
        },
      },
    ]);
  }

  const appVersion = Constants.expoConfig?.version ?? FALLBACK_VERSION;

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <Text variant="h1" tKey="settings.title" className="mb-4 mt-4" />

        <Card padding="md">
          <Pressable
            onPress={() => router.push(ROUTES.LANGUAGE_SELECT)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.language" />
            <Text variant="caption" className="text-stone">
              ›
            </Text>
          </Pressable>

          <View className="flex-row items-center justify-between py-3">
            <Text variant="body" tKey="settings.shakeToSos" className="flex-1" />
            <Switch
              value={shakeEnabled}
              onValueChange={handleShakeToggle}
              trackColor={{ true: COLORS.SHAKTI_PURPLE, false: COLORS.STONE }}
            />
          </View>

          <View className="flex-row items-center justify-between py-3">
            <Text variant="body" tKey="settings.lowBatteryAlert" className="flex-1" />
            <Switch
              value={lowBatteryEnabled}
              onValueChange={handleBatteryToggle}
              trackColor={{ true: COLORS.SHAKTI_PURPLE, false: COLORS.STONE }}
            />
          </View>
        </Card>

        <Card padding="md" className="mt-4">
          <Text variant="label" tKey="settings.about" className="mb-2" />
          <Text
            variant="caption"
            tKey="settings.version"
            tOptions={{ version: appVersion }}
            className="py-2 text-stone"
          />
          <Text variant="body" tKey="settings.terms" className="py-2 text-shakti-purple" />
          <Text variant="body" tKey="settings.privacyPolicy" className="py-2 text-shakti-purple" />
        </Card>

        <Card padding="md" className="mt-4">
          <Pressable
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            className="py-3"
            hitSlop={ROW_ICON_SIZE}
          >
            <Text variant="body" tKey="settings.deleteAccount" className="text-error-red" />
          </Pressable>
        </Card>
      </SafeScreen>
    </ErrorBoundary>
  );
}
