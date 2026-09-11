import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { z } from 'zod';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import {
  CITY_MAX,
  CITY_MIN,
  NAME_MAX,
  NAME_MIN,
  ONBOARDING_STEP_COUNT,
  PROFILE_PHOTO_ASPECT,
  PROFILE_PHOTO_QUALITY,
  REQUIRED_PERMISSIONS,
} from '@/constants/auth';
import { COLORS } from '@/constants/colors';
import { LANGUAGE_OPTIONS } from '@/constants/languages';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import { changeLanguage, detectDeviceLanguage } from '@/i18n';
import { ANALYTICS_EVENTS, identifyUser, trackEvent } from '@/services/analytics.service';
import { getCurrentUser } from '@/services/firebase/auth.service';
import { createUserProfile, uploadProfilePhoto } from '@/services/firebase/user.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import type { Language } from '@/types/user.types';
import {
  requestCameraPermission,
  requestContactsPermission,
  requestLocationPermission,
  requestNotificationPermission,
  type PermissionKey,
} from '@/utils/permissions.utils';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface PermissionItem {
  key: PermissionKey;
  icon: IconName;
  required: boolean;
  titleKey: string;
  reasonKey: string;
  request: () => Promise<boolean>;
}

const PERMISSION_ITEMS: readonly PermissionItem[] = [
  {
    key: 'location',
    icon: 'location-on',
    required: true,
    titleKey: 'onboarding.locationPermission',
    reasonKey: 'onboarding.locationReason',
    request: requestLocationPermission,
  },
  {
    key: 'contacts',
    icon: 'contacts',
    required: true,
    titleKey: 'onboarding.contactsPermission',
    reasonKey: 'onboarding.contactsReason',
    request: requestContactsPermission,
  },
  {
    key: 'notifications',
    icon: 'notifications',
    required: false,
    titleKey: 'onboarding.notificationsPermission',
    reasonKey: 'onboarding.notificationsReason',
    request: requestNotificationPermission,
  },
  {
    key: 'camera',
    icon: 'camera-alt',
    required: false,
    titleKey: 'onboarding.cameraPermission',
    reasonKey: 'onboarding.cameraReason',
    request: requestCameraPermission,
  },
];

const profileSchema = z.object({
  name: z
    .string()
    .min(NAME_MIN, { message: 'onboarding.nameInvalid' })
    .max(NAME_MAX, { message: 'onboarding.nameInvalid' }),
  city: z
    .string()
    .min(CITY_MIN, { message: 'onboarding.cityInvalid' })
    .max(CITY_MAX, { message: 'onboarding.cityInvalid' }),
});

type ProfileForm = z.infer<typeof profileSchema>;

const LANGUAGE_STEP = 1;
const PERMISSIONS_STEP = 2;
const PROFILE_STEP = 3;

export default function OnboardingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const setSurakshakUser = useAuthStore((state) => state.setSurakshakUser);
  const setProfileMirror = useUserStore((state) => state.setProfile);

  const [step, setStep] = useState<number>(LANGUAGE_STEP);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(detectDeviceLanguage);
  const [grantedPermissions, setGrantedPermissions] = useState<PermissionKey[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: '', city: '' },
  });

  function handleSelectLanguage(code: Language): void {
    setSelectedLanguage(code);
    changeLanguage(code).catch((languageError: unknown) => captureException(languageError));
  }

  async function handleRequestPermission(item: PermissionItem): Promise<void> {
    try {
      const granted = await item.request();
      if (granted) {
        setGrantedPermissions((previous) =>
          previous.includes(item.key) ? previous : [...previous, item.key],
        );
      }
    } catch (permissionError) {
      captureException(permissionError);
    }
  }

  function handleContinueFromPermissions(): void {
    const requiredGranted = REQUIRED_PERMISSIONS.every((key) => grantedPermissions.includes(key));
    if (!requiredGranted) {
      Alert.alert(t('onboarding.cannotSkipRequired'));
      return;
    }
    setStep(PROFILE_STEP);
  }

  async function handlePickPhoto(): Promise<void> {
    setIsPhotoUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: PROFILE_PHOTO_ASPECT,
        quality: PROFILE_PHOTO_QUALITY,
      });

      const asset = result.canceled ? undefined : result.assets[0];
      const user = getCurrentUser();
      if (asset === undefined || user === null) return;

      const url = await uploadProfilePhoto(user.uid, asset.uri);
      setProfilePhotoUrl(url);
    } catch (uploadError) {
      captureException(uploadError);
      Alert.alert(t('errors.uploadFailed'));
    } finally {
      setIsPhotoUploading(false);
    }
  }

  async function handleComplete({ name, city }: ProfileForm): Promise<void> {
    const user = getCurrentUser();
    if (user === null) {
      // Auth state was lost between OTP and here — restart the sign-in flow.
      Alert.alert(t('errors.sessionExpired'));
      router.replace(ROUTES.PHONE);
      return;
    }

    setIsSaving(true);
    try {
      const profile = await createUserProfile(user.uid, {
        name,
        city,
        language: selectedLanguage,
        phone: user.phoneNumber ?? '',
        profilePhotoUrl: profilePhotoUrl ?? '',
      });
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, STORAGE_FLAG_ON);
      setSurakshakUser(profile);
      setProfileMirror(profile);
      identifyUser(user.uid);
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        language: selectedLanguage,
        permissions_granted: grantedPermissions,
      });
      router.replace(ROUTES.HOME);
    } catch (saveError) {
      captureException(saveError);
      Alert.alert(t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <View className="mb-8 mt-4 flex-row justify-center gap-3">
          {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
            <View
              key={`dot-${index}`}
              className={`h-2 w-2 rounded-full ${
                index < step ? 'bg-shakti-purple' : 'bg-stone/30'
              }`}
            />
          ))}
        </View>

        {step === LANGUAGE_STEP ? (
          <View>
            <Text variant="h2" tKey="onboarding.step1Title" />
            <Text
              variant="caption"
              tKey="onboarding.step1Subtitle"
              className="mb-6 mt-1 text-stone"
            />

            {LANGUAGE_OPTIONS.map((option) => {
              const isSelected = option.code === selectedLanguage;
              return (
                <Pressable
                  key={option.code}
                  onPress={() => handleSelectLanguage(option.code)}
                  accessibilityRole="button"
                  className={`mb-3 flex-row items-center rounded-2xl border p-4 ${
                    isSelected
                      ? 'border-2 border-shakti-purple bg-shakti-purple/10'
                      : 'border-stone/20 bg-white'
                  }`}
                >
                  <Text variant="h3" className="mr-3">
                    {option.flag}
                  </Text>
                  <View>
                    <Text variant="body">{option.native}</Text>
                    <Text variant="caption">{option.englishName}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6"
              label={t('onboarding.next')}
              onPress={() => setStep(PERMISSIONS_STEP)}
            />
          </View>
        ) : null}

        {step === PERMISSIONS_STEP ? (
          <View>
            <Text variant="h2" tKey="onboarding.step2Title" />
            <Text
              variant="caption"
              tKey="onboarding.step2Subtitle"
              className="mb-6 mt-1 text-stone"
            />

            {PERMISSION_ITEMS.map((item) => {
              const isGranted = grantedPermissions.includes(item.key);
              return (
                <Card key={item.key} padding="md" className="mb-3 flex-row items-center gap-3">
                  <MaterialIcons
                    name={item.icon}
                    size={ICON_SIZE.PERMISSION}
                    color={COLORS.SHAKTI_PURPLE}
                  />
                  <View className="flex-1">
                    <Text variant="label" tKey={item.titleKey} className="text-ink" />
                    <Text variant="caption" tKey={item.reasonKey} className="text-stone" />
                    <Text
                      variant="caption"
                      tKey={item.required ? 'onboarding.required' : 'onboarding.recommended'}
                      className={item.required ? 'text-primary-red' : 'text-stone'}
                    />
                  </View>
                  {isGranted ? (
                    <MaterialIcons
                      name="check-circle"
                      size={ICON_SIZE.STATUS}
                      color={COLORS.FOREST_GREEN}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      label={t('onboarding.allow')}
                      onPress={() => void handleRequestPermission(item)}
                    />
                  )}
                </Card>
              );
            })}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6"
              label={t('onboarding.next')}
              onPress={handleContinueFromPermissions}
            />
          </View>
        ) : null}

        {step === PROFILE_STEP ? (
          <View>
            <Text variant="h2" tKey="onboarding.step3Title" />
            <Text
              variant="caption"
              tKey="onboarding.step3Subtitle"
              className="mb-6 mt-1 text-stone"
            />

            <Pressable
              onPress={() => void handlePickPhoto()}
              accessibilityRole="button"
              className="mb-6 items-center"
            >
              {isPhotoUploading ? (
                <Spinner size="lg" />
              ) : profilePhotoUrl !== null ? (
                <Avatar size="lg" uri={profilePhotoUrl} />
              ) : (
                <Avatar size="lg" />
              )}
              <Text
                variant="label"
                tKey={profilePhotoUrl === null ? 'onboarding.addPhoto' : 'onboarding.changePhoto'}
                className="mt-2 text-shakti-purple"
              />
            </Pressable>

            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  label={t('onboarding.nameLabel')}
                  placeholder={t('onboarding.namePlaceholder')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.name ? t(errors.name.message ?? 'errors.generic') : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <Input
                  label={t('onboarding.cityLabel')}
                  placeholder={t('onboarding.cityPlaceholder')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.city ? t(errors.city.message ?? 'errors.generic') : undefined}
                />
              )}
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              label={t('onboarding.getStarted')}
              loading={isSaving}
              disabled={!isValid || isSaving}
              onPress={() => {
                void handleSubmit(handleComplete)();
              }}
            />
          </View>
        ) : null}
      </SafeScreen>
    </ErrorBoundary>
  );
}
