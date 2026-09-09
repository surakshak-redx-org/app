import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text as RNText } from 'react-native';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';

export interface TextProps {
  variant: TextVariant;
  children?: React.ReactNode;
  /** i18n key. When set, takes precedence over `children`. */
  tKey?: string;
  tOptions?: Record<string, unknown>;
  className?: string;
  numberOfLines?: number;
}

const VARIANT_CLASSES: Record<TextVariant, string> = {
  h1: 'text-3xl font-bold text-ink',
  h2: 'text-2xl font-semibold text-ink',
  h3: 'text-xl font-semibold text-ink',
  body: 'text-base font-normal text-ink',
  caption: 'text-sm font-normal text-stone',
  label: 'text-sm font-medium text-stone',
};

export function Text({
  variant,
  children,
  tKey,
  tOptions,
  className,
  numberOfLines,
}: TextProps): React.JSX.Element {
  const { t } = useTranslation();

  const base = VARIANT_CLASSES[variant];
  const composed = className === undefined ? base : `${base} ${className}`;
  const content = tKey === undefined ? children : t(tKey, tOptions ?? {});

  return (
    <RNText className={composed} numberOfLines={numberOfLines}>
      {content}
    </RNText>
  );
}
