import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

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
  /** Neutral secondary line under the label (e.g. "2 contacts"). */
  subtitle?: string | undefined;
  /**
   * Corner warning badge — reserved for something that needs action (e.g.
   * "Add contacts"). A red number here read as an unread notification
   * count, which is what made the contacts card confusing (BUG-004).
   */
  warning?: string | undefined;
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
  subtitle,
  warning,
  locked = false,
  testID,
}: QuickActionCardProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions();
  const isLargeFont = fontScale >= 1.3;

  const cardClass = active
    ? 'border-2 border-forest-green bg-forest-green/10'
    : 'border-2 border-transparent';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      testID={testID}
      className={isLargeFont ? 'w-full p-1.5' : 'w-1/2 p-1.5'}
    >
      <Card
        padding="md"
        className={`${isLargeFont ? 'flex-row items-center gap-3' : 'items-center'} ${cardClass} ${locked ? 'opacity-50' : ''}`}
      >
        <Ionicons
          name={locked ? 'lock-closed' : icon}
          size={ICON_SIZE.PERMISSION}
          color={COLORS.SHAKTI_PURPLE}
        />
        <View className={isLargeFont ? 'flex-1' : 'items-center'}>
          <Text
            variant="label"
            tKey={labelKey}
            className={isLargeFont ? 'text-left' : 'mt-2 text-center'}
          />
          {subtitle !== undefined && (
            <Text
              variant="caption"
              className={isLargeFont ? 'mt-0.5 text-left' : 'mt-0.5 text-center'}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {warning !== undefined && (
          <View
            className={
              isLargeFont
                ? 'flex-row items-center gap-0.5 rounded-full bg-saffron px-2 py-0.5'
                : 'absolute right-0 top-0 flex-row items-center gap-0.5 rounded-full bg-saffron px-2 py-0.5'
            }
          >
            <Ionicons name="alert-circle" size={ICON_SIZE.BADGE} color={COLORS.NEAR_BLACK} />
            <Text variant="caption" className="text-xs font-semibold text-near-black">
              {warning}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
