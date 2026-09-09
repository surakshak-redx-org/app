import React from 'react';
import { Text as RNText, View } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

export interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-forest-green',
  warning: 'bg-saffron',
  error: 'bg-error-red',
  info: 'bg-shakti-purple',
  default: 'bg-stone',
};

export function Badge({ label, variant, className }: BadgeProps): React.JSX.Element {
  const base = `self-start rounded-full px-3 py-1 ${VARIANT_CLASSES[variant]}`;
  const composed = className === undefined ? base : `${base} ${className}`;

  return (
    <View className={composed}>
      <RNText className="text-xs font-semibold text-white">{label}</RNText>
    </View>
  );
}
