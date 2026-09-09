export const COLORS = {
  PRIMARY_RED: '#D4380D',
  SHAKTI_PURPLE: '#722ED1',
  SAFFRON: '#FA8C16',
  FOREST_GREEN: '#389E0D',
  OFF_WHITE: '#F5F5F5',
  WHITE: '#FFFFFF',
  DEEP_INK: '#141414',
  STONE: '#595959',
  ERROR_RED: '#CF1322',
  NEAR_BLACK: '#0A0A0A',
  CHARCOAL: '#1A1A1A',
} as const;

export type ColorKey = keyof typeof COLORS;
