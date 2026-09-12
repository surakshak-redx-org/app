import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text as RNText } from 'react-native';

import {
  DEVANAGARI_FONT_CLASSES,
  DEVANAGARI_LANGUAGES,
  type FontWeightKey,
} from '@/constants/typography';

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
  h1: 'text-3xl font-bold text-ink dark:text-white',
  h2: 'text-2xl font-semibold text-ink dark:text-white',
  h3: 'text-xl font-semibold text-ink dark:text-white',
  body: 'text-base font-normal text-ink dark:text-off-white',
  caption: 'text-sm font-normal text-stone dark:text-dark-text-secondary',
  label: 'text-sm font-medium text-stone dark:text-white',
};

// Matches each variant to the FONT_WEIGHTS bucket its className above uses,
// so the right Devanagari face gets applied on Android — see DEVANAGARI_FONT_CLASSES.
const VARIANT_WEIGHTS: Record<TextVariant, FontWeightKey> = {
  h1: 'bold',
  h2: 'semibold',
  h3: 'semibold',
  body: 'regular',
  caption: 'regular',
  label: 'medium',
};

export function Text({
  variant,
  children,
  tKey,
  tOptions,
  className,
  numberOfLines,
}: TextProps): React.JSX.Element {
  const { t, i18n } = useTranslation();

  const base = VARIANT_CLASSES[variant];
  const isDevanagariLanguage = DEVANAGARI_LANGUAGES.includes(i18n.language);
  const devanagariClass =
    Platform.OS === 'android' && isDevanagariLanguage
      ? DEVANAGARI_FONT_CLASSES[VARIANT_WEIGHTS[variant]]
      : '';
  const composed = [base, devanagariClass, className].filter(Boolean).join(' ');
  const content = tKey === undefined ? children : t(tKey, tOptions ?? {});

  return (
    <RNText className={composed} numberOfLines={numberOfLines}>
      {content}
    </RNText>
  );
}
