import { Image } from 'expo-image';
import React from 'react';
import { Text as RNText, View } from 'react-native';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  uri?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
};

const TEXT_SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-3xl',
};

function initialOf(name: string | undefined): string {
  return name === undefined || name.length === 0 ? '?' : name.trim().charAt(0).toUpperCase();
}

export function Avatar({ uri, name, size = 'md', className }: AvatarProps): React.JSX.Element {
  const base = `${SIZE_CLASSES[size]} rounded-full overflow-hidden`;
  const composed = className === undefined ? base : `${base} ${className}`;

  if (uri !== undefined && uri.length > 0) {
    return (
      <Image
        source={{ uri }}
        className={composed}
        contentFit="cover"
        accessibilityLabel={name ?? 'Profile photo'}
      />
    );
  }

  return (
    <View className={`${composed} items-center justify-center bg-shakti-purple`}>
      <RNText className={`font-semibold text-white ${TEXT_SIZE_CLASSES[size]}`}>
        {initialOf(name)}
      </RNText>
    </View>
  );
}
