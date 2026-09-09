import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
}

const NATIVE_SIZE: Record<SpinnerSize, 'small' | 'large'> = {
  sm: 'small',
  md: 'small',
  lg: 'large',
};

export function Spinner({
  size = 'md',
  color = COLORS.SHAKTI_PURPLE,
  className,
}: SpinnerProps): React.JSX.Element {
  return (
    <View className={className ?? 'items-center justify-center'}>
      <ActivityIndicator size={NATIVE_SIZE[size]} color={color} />
    </View>
  );
}
