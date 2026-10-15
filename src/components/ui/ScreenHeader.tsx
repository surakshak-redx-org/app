import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ICON_SIZE } from '@/constants/ui';
import { useTheme } from '@/hooks/useTheme';

export interface ScreenHeaderProps {
  /** i18n key for the screen title. */
  titleKey: string;
}

/**
 * A back chevron + title for stacked (non-tab) screens. The root navigator
 * renders no native header, so screens that are pushed onto the stack use this
 * for a consistent way back.
 */
export function ScreenHeader({ titleKey }: ScreenHeaderProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View className="mb-2 mt-4 flex-row items-center gap-2">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={ICON_SIZE.BACK}
      >
        <MaterialIcons name="arrow-back" size={ICON_SIZE.BACK} color={colors.textPrimary} />
      </Pressable>
      <Text variant="h2" tKey={titleKey} />
    </View>
  );
}
