import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';

export interface SafetyStatusCardProps {
  contactCount: number;
  isGuest: boolean;
  shakeEnabled: boolean;
  onAddContacts: () => void;
  onSignIn: () => void;
}

export function SafetyStatusCard({
  contactCount,
  isGuest,
  shakeEnabled,
  onAddContacts,
  onSignIn,
}: SafetyStatusCardProps): React.JSX.Element {
  const { t } = useTranslation();

  if (isGuest) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        className="mt-3 flex-row items-center justify-between rounded-xl border border-saffron/30 bg-saffron/10 px-4 py-3"
      >
        <View className="flex-1 flex-row items-center gap-3">
          <Ionicons name="shield-outline" size={ICON_SIZE.ROW} color={COLORS.SAFFRON} />
          <View className="flex-1">
            <Text variant="label" className="text-near-black dark:text-white">
              {t('home.shieldActive')}
            </Text>
            <Text
              variant="caption"
              tKey="home.shieldWarningGuest"
              className="mt-0.5 text-stone dark:text-dark-text-secondary"
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={ICON_SIZE.BADGE} color={COLORS.STONE} />
      </Pressable>
    );
  }

  if (contactCount === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onAddContacts}
        className="mt-3 flex-row items-center justify-between rounded-xl border border-primary-red/40 bg-primary-red/10 px-4 py-3"
      >
        <View className="flex-1 flex-row items-center gap-3">
          <Ionicons name="alert-circle" size={ICON_SIZE.ROW} color={COLORS.PRIMARY_RED} />
          <View className="flex-1">
            <Text variant="label" className="text-primary-red dark:text-primary-red">
              {t('home.shieldWarningNoContacts')}
            </Text>
          </View>
        </View>
        <View className="rounded-full bg-primary-red px-3 py-1">
          <Text variant="caption" className="font-semibold text-white">
            {t('home.setupContacts')}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View className="mt-3 flex-row items-center justify-between rounded-xl border border-forest-green/30 bg-forest-green/10 px-4 py-3">
      <View className="flex-1 flex-row items-center gap-3">
        <Ionicons name="shield-checkmark" size={ICON_SIZE.ROW} color={COLORS.FOREST_GREEN} />
        <View className="flex-1">
          <Text variant="label" tKey="home.shieldActive" className="text-forest-green" />
          <Text
            variant="caption"
            tKey="home.shieldSubtitle"
            tOptions={{ count: contactCount }}
            className="mt-0.5 text-stone dark:text-dark-text-secondary"
          />
        </View>
      </View>
      {shakeEnabled && (
        <View className="flex-row items-center gap-1 rounded-full bg-forest-green/20 px-2 py-0.5">
          <Ionicons
            name="phone-portrait-outline"
            size={ICON_SIZE.BADGE}
            color={COLORS.FOREST_GREEN}
          />
          <Text variant="caption" className="text-xs font-medium text-forest-green">
            Shake SOS
          </Text>
        </View>
      )}
    </View>
  );
}
