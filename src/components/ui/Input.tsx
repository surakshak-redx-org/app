import React, { forwardRef } from 'react';
import { Text as RNText, TextInput, View, type TextInputProps } from 'react-native';

import { COLORS } from '@/constants/colors';

export interface InputProps extends TextInputProps {
  label?: string | undefined;
  error?: string | undefined;
  helper?: string | undefined;
  className?: string;
}

/**
 * Forwards its ref so `react-hook-form`'s Controller can focus the field on a
 * validation failure.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, className, ...textInputProps },
  ref,
): React.JSX.Element {
  const hasError = error !== undefined && error.length > 0;

  const fieldClasses = [
    // `text-[16px]` (font size only) instead of `text-base` (font size +
    // line-height) deliberately: RN's single-line TextInput vertically
    // centers itself on iOS, but a `lineHeight` style fights that
    // centering — leaving text sitting noticeably off-center in the box.
    'min-h-[48px] rounded-xl border bg-white px-4 py-3 text-[16px] text-ink dark:bg-charcoal dark:text-white',
    hasError ? 'border-error-red' : 'border-stone/30 dark:border-dark-border',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className="mb-4 w-full">
      {label !== undefined && (
        <RNText className="mb-1 text-sm font-medium text-stone dark:text-dark-text-secondary">
          {label}
        </RNText>
      )}

      <TextInput
        ref={ref}
        className={fieldClasses}
        placeholderTextColor={COLORS.STONE}
        accessibilityLabel={label}
        {...textInputProps}
      />

      {hasError ? (
        <RNText className="mt-1 text-sm text-error-red">{error}</RNText>
      ) : (
        helper !== undefined && (
          <RNText className="mt-1 text-sm text-stone dark:text-dark-text-secondary">
            {helper}
          </RNText>
        )
      )}
    </View>
  );
});
