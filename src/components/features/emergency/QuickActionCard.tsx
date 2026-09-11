import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';

type IconName = keyof typeof Ionicons.glyphMap;

export interface QuickActionCardProps {
  icon: IconName;
  labelKey: string;
  onPress: () => void;
  /** Highlights the card when the feature it toggles is currently on. */
  active?: boolean;
  /** Small red count badge (e.g. number of saved contacts). */
  badge?: string | undefined;
  /**
   * Dims the card and swaps its icon for a lock — for a feature guest mode
   * can't use (it writes to the user's own Firestore/Storage data, which
   * requires a real sign-in). `onPress` still fires; the caller decides what
   * that does (e.g. show a sign-in prompt) rather than this presentational
   * component owning any auth/navigation logic.
   */
  locked?: boolean;
  testID?: string | undefined;
}

export function QuickActionCard({
  icon,
  labelKey,
  onPress,
  active = false,
  badge,
  locked = false,
  testID,
}: QuickActionCardProps): React.JSX.Element {
  const cardClass = active
    ? 'border-2 border-forest-green bg-forest-green/10'
    : 'border-2 border-transparent';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      testID={testID}
      className="w-1/2 p-1.5"
    >
      <Card padding="md" className={`items-center ${cardClass} ${locked ? 'opacity-50' : ''}`}>
        <View className="items-center">
          <Ionicons
            name={locked ? 'lock-closed' : icon}
            size={ICON_SIZE.PERMISSION}
            color={COLORS.SHAKTI_PURPLE}
          />
          <Text variant="label" tKey={labelKey} className="mt-2 text-center text-ink" />
        </View>
        {badge !== undefined && (
          <View className="absolute right-0 top-0 min-w-[20px] items-center rounded-full bg-error-red px-1.5 py-0.5">
            <Text variant="caption" className="text-xs text-white">
              {badge}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
