import React from 'react';
import { View } from 'react-native';

export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  className?: string;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, padding = 'md', className }: CardProps): React.JSX.Element {
  const base = `rounded-2xl bg-white shadow-sm ${PADDING_CLASSES[padding]}`;
  const composed = className === undefined ? base : `${base} ${className}`;

  return <View className={composed}>{children}</View>;
}
