import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ConfirmationResult } from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import {
  BACK_ICON_SIZE,
  PHONE_DIGITS,
  PHONE_E164_PREFIX,
  PHONE_LAST_DIGITS,
  PHONE_PREFIX_LABEL,
} from '@/constants/auth';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import { ANALYTICS_EVENTS, trackEvent } from '@/services/analytics.service';
import { AuthError, sendOtp } from '@/services/firebase/auth.service';

/**
 * Survives the navigation from this screen to the OTP screen. A Firebase
 * `ConfirmationResult` is a live object and cannot be passed as a route param.
 */
let storedConfirmation: ConfirmationResult | null = null;

export function getStoredConfirmation(): ConfirmationResult | null {
  return storedConfirmation;
}

export function setStoredConfirmation(value: ConfirmationResult | null): void {
  storedConfirmation = value;
}

const schema = z.object({
  phone: z
    .string()
    .length(PHONE_DIGITS, { message: 'auth.phoneInvalid' })
    .regex(/^[6-9]\d{9}$/, { message: 'auth.phoneInvalid' }),
});

type PhoneForm = z.infer<typeof schema>;

export default function PhoneScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm<PhoneForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { phone: '' },
  });

  async function handleSendOtp({ phone }: PhoneForm): Promise<void> {
    setIsLoading(true);
    try {
      const confirmation = await sendOtp(phone);
      setStoredConfirmation(confirmation);
      trackEvent(ANALYTICS_EVENTS.OTP_REQUESTED, { phone_last4: phone.slice(-PHONE_LAST_DIGITS) });
      router.push({
        pathname: ROUTES.OTP,
        params: { phone: `${PHONE_E164_PREFIX}${phone}` },
      });
    } catch (error) {
      setError('phone', {
        message: error instanceof AuthError ? error.i18nKey : 'errors.generic',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const phoneError = errors.phone?.message;

  return (
    <ErrorBoundary>
      <SafeScreen>
        <Pressable
          onPress={() => router.back()}
          className="mt-2 h-11 w-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <MaterialIcons name="arrow-back" size={BACK_ICON_SIZE} color={COLORS.DEEP_INK} />
        </Pressable>

        <Text variant="h2" tKey="auth.enterPhone" className="mb-2 mt-6" />
        <Text variant="caption" tKey="auth.phonePlaceholder" className="text-stone" />

        <View className="mt-6 h-14 flex-row items-center rounded-xl border border-stone/30 px-4">
          <RNText className="mr-2 text-base text-ink">{PHONE_PREFIX_LABEL}</RNText>
          <View className="mr-2 h-6 w-px bg-stone/30" />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextInput
                className="flex-1 text-base text-ink"
                keyboardType="phone-pad"
                maxLength={PHONE_DIGITS}
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor={COLORS.STONE}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(text) => field.onChange(text.replace(/\D/g, ''))}
                accessibilityLabel={t('auth.phoneLabel')}
              />
            )}
          />
        </View>

        {phoneError !== undefined ? (
          <Text variant="caption" className="mt-1 text-error-red">
            {t(phoneError)}
          </Text>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-8"
          label={t('auth.sendOtp')}
          loading={isLoading}
          disabled={!isValid || isLoading}
          onPress={() => {
            void handleSubmit(handleSendOtp)();
          }}
        />
      </SafeScreen>
    </ErrorBoundary>
  );
}
