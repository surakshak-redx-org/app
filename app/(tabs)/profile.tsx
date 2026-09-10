import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { GuestBanner } from '@/components/features/auth/GuestBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { languageLabel } from '@/constants/languages';
import { ROUTES } from '@/constants/routes';
import { ICON_SIZE } from '@/constants/ui';
import { useAuth } from '@/hooks/useAuth';
import { ANALYTICS_EVENTS, trackEvent } from '@/services/analytics.service';
import { formatTimestamp } from '@/utils/date.utils';
import { maskPhone } from '@/utils/phone.utils';

interface SettingsRow {
  icon: keyof typeof MaterialIcons.glyphMap;
  labelKey: string;
  route: Href;
  value?: string | undefined;
}

export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { surakshakUser, isGuest, signOut } = useAuth();

  // `createdAt` is a pending server timestamp right after onboarding and can be
  // null locally until the write round-trips.
  const createdAt = surakshakUser?.createdAt;
  const memberSince =
    createdAt != null && typeof createdAt.toDate === 'function'
      ? formatTimestamp(createdAt.toDate())
      : '';

  const rows: SettingsRow[] = [
    { icon: 'contacts', labelKey: 'profile.emergencyContacts', route: ROUTES.EMERGENCY_CONTACTS },
    {
      icon: 'language',
      labelKey: 'profile.language',
      route: ROUTES.LANGUAGE_SELECT,
      value: surakshakUser !== null ? languageLabel(surakshakUser.language) : undefined,
    },
    { icon: 'settings', labelKey: 'profile.settings', route: ROUTES.SETTINGS },
  ];

  function handleSignOut(): void {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: (): void => {
          trackEvent(ANALYTICS_EVENTS.SIGN_OUT, {});
          void signOut();
        },
      },
    ]);
  }

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <Text variant="h1" tKey="profile.title" className="mb-4 mt-4" />

        {isGuest ? (
          <View>
            <GuestBanner />
            <Card padding="md" className="mt-4">
              {rows.map((row) => (
                <View key={row.labelKey} className="flex-row items-center gap-3 py-3">
                  <MaterialIcons name="lock" size={ICON_SIZE.ROW} color={COLORS.STONE} />
                  <Text variant="body" tKey={row.labelKey} className="flex-1 text-stone" />
                </View>
              ))}
            </Card>
          </View>
        ) : (
          <View>
            <Card padding="lg" className="items-center">
              <Avatar
                size="lg"
                uri={
                  surakshakUser?.profilePhotoUrl !== undefined &&
                  surakshakUser.profilePhotoUrl.length > 0
                    ? surakshakUser.profilePhotoUrl
                    : undefined
                }
                name={surakshakUser?.name}
              />
              <Text variant="h2" className="mt-3">
                {surakshakUser?.name ?? ''}
              </Text>
              <Text variant="body" className="mt-1 text-stone">
                {maskPhone(surakshakUser?.phone ?? '')}
              </Text>
              <Text
                variant="caption"
                tKey="profile.memberSince"
                tOptions={{ date: memberSince }}
                className="mt-1 text-stone"
              />
            </Card>

            <Card padding="md" className="mt-4">
              {rows.map((row) => (
                <Pressable
                  key={row.labelKey}
                  onPress={() => router.push(row.route)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-3 py-3"
                >
                  <MaterialIcons
                    name={row.icon}
                    size={ICON_SIZE.ROW}
                    color={COLORS.SHAKTI_PURPLE}
                  />
                  <Text variant="body" tKey={row.labelKey} className="flex-1" />
                  {row.value !== undefined ? (
                    <Text variant="caption" className="text-stone">
                      {row.value}
                    </Text>
                  ) : null}
                  <MaterialIcons
                    name="chevron-right"
                    size={ICON_SIZE.CHEVRON}
                    color={COLORS.STONE}
                  />
                </Pressable>
              ))}
            </Card>

            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              className="mt-8 items-center py-3"
            >
              <Text variant="body" tKey="profile.signOut" className="text-error-red" />
            </Pressable>
          </View>
        )}
      </SafeScreen>
    </ErrorBoundary>
  );
}
