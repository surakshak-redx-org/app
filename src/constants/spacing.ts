export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  giant: 64,
} as const;

export type SpacingKey = keyof typeof SPACING;

/** Android and iOS accessibility guidelines both require a 44pt minimum. */
export const MIN_TOUCH_TARGET = 44;
