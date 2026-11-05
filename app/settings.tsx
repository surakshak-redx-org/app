import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, View } from 'react-native';

import { DisguisePinModal } from '@/components/features/settings/DisguisePinModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { getRunningUpdateHash } from '@/config/updates';
import { FALLBACK_APP_VERSION } from '@/constants/auth';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import {
  STORAGE_FLAG_OFF,
  STORAGE_FLAG_ON,
  STORAGE_KEYS,
  type StorageKey,
} from '@/constants/storage';
import { DANGER_ROW_HITSLOP, ICON_SIZE } from '@/constants/ui';
import { useSafeCheckinActive } from '@/hooks/useSafeCheckin';
import {
  ANALYTICS_EVENTS,
  resetUser as resetAnalytics,
  trackDisguiseModeEnabled,
  trackEvent,
} from '@/services/analytics.service';
import { setDisguiseIcon } from '@/services/disguise.service';
import { AuthError, deleteAccount } from '@/services/firebase/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { useDisguiseStore } from '@/stores/disguise.store';
import { useUserStore } from '@/stores/user.store';
import { calculateSMSCharacterCount, interpolateSOSTemplate } from '@/utils/sms.utils';

type DisguiseModalMode = 'enable' | 'disable' | 'change' | null;

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [lowBatteryEnabled, setLowBatteryEnabled] = useState(true);
  const [followDetectionEnabled, setFollowDetectionEnabled] = useState(true);
  const checkinActive = useSafeCheckinActive();
  const [disguiseEnabled, setDisguiseEnabled] = useState(false);
  const [disguiseModalMode, setDisguiseModalMode] = useState<DisguiseModalMode>(null);
  const [customSosTemplate, setCustomSosTemplate] = useState('');
  const surakshakUser = useAuthStore((state) => state.surakshakUser);

  useEffect(() => {
    AsyncStorage.multiGet([
      STORAGE_KEYS.SHAKE_ENABLED,
      STORAGE_KEYS.LOW_BATTERY_ENABLED,
      STORAGE_KEYS.FOLLOW_DETECTION_ENABLED,
      STORAGE_KEYS.DISGUISE_ENABLED,
      STORAGE_KEYS.CUSTOM_SOS_MESSAGE_TEMPLATE,
    ])
      .then((entries) => {
        const stored = new Map<string, string | null>(entries);
        setShakeEnabled(stored.get(STORAGE_KEYS.SHAKE_ENABLED) !== STORAGE_FLAG_OFF);
        setLowBatteryEnabled(stored.get(STORAGE_KEYS.LOW_BATTERY_ENABLED) !== STORAGE_FLAG_OFF);
        setFollowDetectionEnabled(
          stored.get(STORAGE_KEYS.FOLLOW_DETECTION_ENABLED) !== STORAGE_FLAG_OFF,
        );
        setDisguiseEnabled(stored.get(STORAGE_KEYS.DISGUISE_ENABLED) === STORAGE_FLAG_ON);
        const savedTemplate = stored.get(STORAGE_KEYS.CUSTOM_SOS_MESSAGE_TEMPLATE);
        if (savedTemplate !== null && savedTemplate !== undefined) {
          setCustomSosTemplate(savedTemplate);
        }
      })
      .catch((error: unknown) => captureException(error));
  }, []);

  function persistToggle(
    key: StorageKey,
    value: boolean,
    revert: (previous: boolean) => void,
  ): void {
    AsyncStorage.setItem(key, value ? STORAGE_FLAG_ON : STORAGE_FLAG_OFF).catch(
      (error: unknown) => {
        captureException(error);
        // The write failed — don't let the switch claim a setting that isn't saved.
        revert(!value);
      },
    );
  }

  function handleShakeToggle(value: boolean): void {
    setShakeEnabled(value);
    persistToggle(STORAGE_KEYS.SHAKE_ENABLED, value, setShakeEnabled);
  }

  function handleBatteryToggle(value: boolean): void {
    setLowBatteryEnabled(value);
    persistToggle(STORAGE_KEYS.LOW_BATTERY_ENABLED, value, setLowBatteryEnabled);
  }

  function handleFollowDetectionToggle(value: boolean): void {
    setFollowDetectionEnabled(value);
    persistToggle(STORAGE_KEYS.FOLLOW_DETECTION_ENABLED, value, setFollowDetectionEnabled);
  }

  function handleSaveSosTemplate(): void {
    const trimmed = customSosTemplate.trim();
    if (trimmed.length === 0) {
      AsyncStorage.removeItem(STORAGE_KEYS.CUSTOM_SOS_MESSAGE_TEMPLATE)
        .then(() => {
          Alert.alert(t('common.save'), t('settings.templateSaved'));
        })
        .catch((error: unknown) => captureException(error));
    } else {
      if (!/\{location\}/i.test(trimmed)) {
        Alert.alert(t('common.error'), t('settings.templateMissingLocation'));
        return;
      }
      AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_SOS_MESSAGE_TEMPLATE, trimmed)
        .then(() => {
          Alert.alert(t('common.save'), t('settings.templateSaved'));
        })
        .catch((error: unknown) => captureException(error));
    }
  }

  function handleResetSosTemplate(): void {
    AsyncStorage.removeItem(STORAGE_KEYS.CUSTOM_SOS_MESSAGE_TEMPLATE)
      .then(() => {
        setCustomSosTemplate('');
      })
      .catch((error: unknown) => captureException(error));
  }

  const characterStats = calculateSMSCharacterCount(customSosTemplate);
  const defaultPlaceholder = t('settings.defaultSosPlaceholder');
  const previewText = interpolateSOSTemplate(
    customSosTemplate.trim().length > 0 ? customSosTemplate : defaultPlaceholder,
    {
      name: surakshakUser?.name ?? t('common.user'),
      locationUrl: 'https://maps.google.com/?q=19.076,72.877',
      battery: 85,
    },
  );

  function handleDisguiseToggle(value: boolean): void {
    setDisguiseModalMode(value ? 'enable' : 'disable');
  }

  /** The icon swap is best-effort: Disguise Mode still works without it. */
  async function applyDisguiseIcon(enabled: boolean): Promise<void> {
    try {
      await setDisguiseIcon(enabled);
    } catch (iconError) {
      captureException(iconError);
      Alert.alert(t('settings.disguiseIconFailed'));
    }
  }

  function handleDisguiseModalSuccess(newPinHash: string | null): void {
    const mode = disguiseModalMode;
    setDisguiseModalMode(null);

    async function apply(): Promise<void> {
      if (mode === 'disable') {
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.DISGUISE_ENABLED,
          STORAGE_KEYS.DISGUISE_PIN_HASH,
        ]);
        setDisguiseEnabled(false);
        useDisguiseStore.getState().setEnabled(false);
        useDisguiseStore.getState().lock();
        await applyDisguiseIcon(false);
        return;
      }
      if (newPinHash === null) return;
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.DISGUISE_ENABLED, STORAGE_FLAG_ON],
        [STORAGE_KEYS.DISGUISE_PIN_HASH, newPinHash],
      ]);
      setDisguiseEnabled(true);
      if (mode === 'enable') {
        await applyDisguiseIcon(true);
        trackDisguiseModeEnabled();
      }
      // Re-arm the calculator gate immediately: if the PIN was unlocked
      // earlier this session, that flag must not let a fresh (re-)enable
      // skip the calculator on the very next launch/navigation.
      useDisguiseStore.getState().setEnabled(true);
      useDisguiseStore.getState().lock();
    }

    apply().catch((error: unknown) => captureException(error));
  }

  async function runDelete(): Promise<void> {
    try {
      await deleteAccount();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ONBOARDING_COMPLETE,
        STORAGE_KEYS.SHAKE_ENABLED,
        STORAGE_KEYS.LOW_BATTERY_ENABLED,
      ]);
      useAuthStore.getState().reset();
      useUserStore.getState().reset();
      resetAnalytics();
      trackEvent(ANALYTICS_EVENTS.ACCOUNT_DELETED, {});
      router.replace(ROUTES.WELCOME);
    } catch (error) {
      captureException(error);
      Alert.alert(t(error instanceof AuthError ? error.i18nKey : 'errors.generic'));
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

  const appVersion = Constants.expoConfig?.version ?? FALLBACK_APP_VERSION;
  const updateHash = getRunningUpdateHash();

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="settings.title" />

        <Card padding="md">
          <Pressable
            onPress={() => router.push(ROUTES.LANGUAGE_SELECT)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.language" />
            <MaterialIcons name="chevron-right" size={ICON_SIZE.CHEVRON} color={COLORS.STONE} />
          </Pressable>

          <Pressable
            onPress={() => router.push(ROUTES.SMS_ALERT_HISTORY)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.smsAlertHistory" />
            <MaterialIcons name="chevron-right" size={ICON_SIZE.CHEVRON} color={COLORS.STONE} />
          </Pressable>

          <Pressable
            onPress={() => router.push(ROUTES.MY_RECORDINGS)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.myRecordings" />
            <MaterialIcons name="chevron-right" size={ICON_SIZE.CHEVRON} color={COLORS.STONE} />
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

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 pr-2">
              <Text variant="body" tKey="settings.followDetection" />
              <Text variant="caption" tKey="settings.followDetectionDesc" className="text-stone" />
            </View>
            <Switch
              value={followDetectionEnabled}
              onValueChange={handleFollowDetectionToggle}
              trackColor={{ true: COLORS.SHAKTI_PURPLE, false: COLORS.STONE }}
            />
          </View>
        </Card>

        <Card padding="md" className="mt-4">
          <Pressable
            onPress={() => router.push(ROUTES.SAFE_CHECKIN)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.safeCheckin" className="flex-1" />
            <Badge
              label={t(checkinActive ? 'settings.safeCheckinActive' : 'settings.safeCheckinOff')}
              variant={checkinActive ? 'success' : 'default'}
              className="mr-2"
            />
            <MaterialIcons name="chevron-right" size={ICON_SIZE.CHEVRON} color={COLORS.STONE} />
          </Pressable>

          <Pressable
            onPress={() => router.push(ROUTES.SILENT_RECORDING)}
            accessibilityRole="button"
            className="flex-row items-center justify-between py-3"
          >
            <Text variant="body" tKey="settings.silentRecording" />
            <MaterialIcons name="chevron-right" size={ICON_SIZE.CHEVRON} color={COLORS.STONE} />
          </Pressable>
        </Card>

        <Card padding="md" className="mt-4">
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 pr-2">
              <Text variant="body" tKey="settings.disguiseMode" />
              <Text variant="caption" tKey="settings.disguiseModeDesc" className="text-stone" />
            </View>
            <Switch
              value={disguiseEnabled}
              onValueChange={handleDisguiseToggle}
              trackColor={{ true: COLORS.SHAKTI_PURPLE, false: COLORS.STONE }}
            />
          </View>

          {disguiseEnabled && (
            <Pressable
              onPress={() => setDisguiseModalMode('change')}
              accessibilityRole="button"
              className="py-3"
            >
              <Text variant="body" tKey="settings.changePin" className="text-shakti-purple" />
            </Pressable>
          )}
        </Card>

        <Card padding="md" className="mt-4">
          <Text variant="label" tKey="settings.customSosMessage" className="mb-1" />
          <Text
            variant="caption"
            tKey="settings.customSosMessageDesc"
            className="mb-3 text-stone"
          />

          <Input
            value={customSosTemplate}
            onChangeText={setCustomSosTemplate}
            multiline
            numberOfLines={3}
            placeholder={defaultPlaceholder}
            accessibilityLabel={t('settings.customSosMessage')}
          />

          <View className="mt-2 flex-row items-center justify-between">
            <Text variant="caption" className="text-stone">
              {characterStats.isUnicode
                ? t('settings.charCountUnicode', {
                    count: characterStats.charCount,
                    limit: characterStats.segmentLimit,
                    segments: characterStats.segments,
                  })
                : t('settings.charCountGsm', {
                    count: characterStats.charCount,
                    limit: characterStats.segmentLimit,
                    segments: characterStats.segments,
                  })}
            </Text>

            <View className="flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                label={t('settings.resetDefault')}
                onPress={handleResetSosTemplate}
              />
              <Button
                variant="primary"
                size="sm"
                label={t('common.save')}
                onPress={handleSaveSosTemplate}
              />
            </View>
          </View>

          {/* Quick Token Chips */}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Text variant="caption" className="text-stone" tKey="settings.insertToken" />
            {(['{name}', '{location}', '{battery}'] as const).map((token) => (
              <Pressable
                key={token}
                onPress={() => setCustomSosTemplate((prev) => `${prev} ${token}`.trim())}
                className="rounded-full border border-shakti-purple/30 bg-shakti-purple/10 px-2.5 py-1"
                accessibilityRole="button"
                accessibilityLabel={t('settings.insertTokenAccessibility', { token })}
              >
                <Text variant="caption" className="font-medium text-shakti-purple">
                  +{token}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Live Preview */}
          <View className="mt-4 rounded-xl border border-stone/20 bg-stone/5 p-3">
            <Text
              variant="caption"
              className="mb-1 font-medium text-stone"
              tKey="settings.messagePreview"
            />
            <Text variant="body" className="text-sm">
              {previewText}
            </Text>
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
          {updateHash !== null && (
            <Text
              variant="caption"
              tKey="settings.updateHash"
              tOptions={{ hash: updateHash }}
              className="py-2 text-stone"
            />
          )}
          <Text variant="body" tKey="settings.terms" className="py-2 text-shakti-purple" />
          <Text variant="body" tKey="settings.privacyPolicy" className="py-2 text-shakti-purple" />
        </Card>

        <Card padding="md" className="mt-6 border border-error-red/30 bg-error-red/5">
          <Pressable
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel={t('settings.deleteAccount')}
            className="flex-row items-center gap-3 py-1"
            hitSlop={DANGER_ROW_HITSLOP}
          >
            <MaterialIcons name="delete-forever" size={22} color={COLORS.ERROR_RED} />
            <View className="flex-1">
              <Text
                variant="body"
                tKey="settings.deleteAccount"
                className="font-medium text-error-red"
              />
            </View>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.ERROR_RED} />
          </Pressable>
        </Card>
      </SafeScreen>

      <DisguisePinModal
        visible={disguiseModalMode !== null}
        mode={disguiseModalMode ?? 'enable'}
        onSuccess={handleDisguiseModalSuccess}
        onCancel={() => setDisguiseModalMode(null)}
      />
    </ErrorBoundary>
  );
}
