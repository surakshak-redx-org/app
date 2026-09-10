import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';

export interface GuestBannerProps {
  /** Overrides the default "sign in to access all features" copy. */
  message?: string;
}

const ICON_SIZE = 24;

export function GuestBanner({ message }: GuestBannerProps): React.JSX.Element {
  const { t } = useTranslation();

  function handleSignIn(): void {
    router.push(ROUTES.WELCOME);
  }

  return (
    <Card padding="md" className="flex-row items-center gap-3">
      <MaterialIcons name="lock" size={ICON_SIZE} color={COLORS.SAFFRON} />
      <View className="flex-1">
        <Text variant="body">{message ?? t('profile.guestBanner')}</Text>
      </View>
      <Button variant="secondary" size="sm" label={t('profile.signInNow')} onPress={handleSignIn} />
    </Card>
  );
}
