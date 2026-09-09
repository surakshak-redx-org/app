export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** 1.4x the matching font size, rounded to the nearest whole pixel. */
export const LINE_HEIGHTS = {
  xs: 17,
  sm: 20,
  md: 22,
  lg: 25,
  xl: 28,
  xxl: 34,
  xxxl: 42,
} as const;

export type FontSizeKey = keyof typeof FONT_SIZES;
export type FontWeightKey = keyof typeof FONT_WEIGHTS;
export type LineHeightKey = keyof typeof LINE_HEIGHTS;
