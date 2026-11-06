import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';

export interface ActiveTrackingBannerProps {
  isSafeJourneyActive: boolean;
  isLiveLocationActive: boolean;
  onManage: () => void;
}

export function ActiveTrackingBanner({
  isSafeJourneyActive,
  isLiveLocationActive,
  onManage,
}: ActiveTrackingBannerProps): React.JSX.Element | null {
  if (!isSafeJourneyActive && !isLiveLocationActive) return null;

  const titleKey =
    isSafeJourneyActive && isLiveLocationActive
      ? 'home.trackingActiveBoth'
      : isSafeJourneyActive
        ? 'home.activeJourneyBannerTitle'
        : 'home.activeLocationBannerTitle';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onManage}
      className="mt-3 flex-row items-center justify-between rounded-xl border border-shakti-purple/40 bg-shakti-purple/10 px-4 py-3"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <Ionicons name="navigate-circle" size={ICON_SIZE.ROW} color={COLORS.SHAKTI_PURPLE} />
        <View className="flex-1">
          <Text variant="label" tKey={titleKey} className="text-shakti-purple" />
          <Text
            variant="caption"
            tKey="home.trackingModalSubtitle"
            className="mt-0.5 text-stone dark:text-dark-text-secondary"
            numberOfLines={1}
          />
        </View>
      </View>
      <View className="flex-row items-center gap-1 rounded-full bg-shakti-purple px-3 py-1">
        <Text variant="caption" tKey="home.manageTracking" className="font-semibold text-white" />
        <Ionicons name="chevron-forward" size={ICON_SIZE.BADGE} color={COLORS.WHITE} />
      </View>
    </Pressable>
  );
}
