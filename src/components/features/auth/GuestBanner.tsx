import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import { ICON_SIZE } from '@/constants/ui';
import { useAuthStore } from '@/stores/auth.store';

export interface GuestBannerProps {
  /** Overrides the default "sign in to access all features" copy. */
  message?: string | undefined;
}

export function GuestBanner({ message }: GuestBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const setGuestSigningIn = useAuthStore((state) => state.setGuestSigningIn);

  function handleSignIn(): void {
    // The root layout treats a guest as "signed in" so it doesn't bounce
    // them out of the app on launch — that same check would otherwise
    // immediately redirect this navigation straight back to Home. See
    // `isGuestSigningIn` on the auth store.
    setGuestSigningIn(true);
    router.push(ROUTES.WELCOME);
  }

  return (
    <Card padding="md" className="flex-row items-center gap-3">
      <MaterialIcons name="lock" size={ICON_SIZE.BANNER} color={COLORS.SAFFRON} />
      <View className="flex-1">
        <Text variant="body">{message ?? t('profile.guestBanner')}</Text>
      </View>
      <Button variant="secondary" size="sm" label={t('profile.signInNow')} onPress={handleSignIn} />
    </Card>
  );
}
