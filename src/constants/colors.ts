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
  DISABLED_BG: '#E5E5E5',
  DISABLED_TEXT: '#595959',
  // Dark mode additions — brand colors (red/purple/saffron/green) are
  // unchanged in dark mode; they stay high-contrast on a dark background.
  DARK_BORDER: '#2A2A2A',
  DARK_TEXT_PRIMARY: '#F5F5F5',
  DARK_TEXT_SECONDARY: '#9CA3AF',
  POLICE_BLUE: '#1890FF',
  HOSPITAL_RED: '#F5222D',
  PHARMACY_GREEN: '#52C41A',
} as const;

export const ACTION_COLORS = {
  CONTACTS: '#6366F1',
  TRACKING: '#7C3AED',
  FAKE_CALL: '#059669',
  SIREN: '#E11D48',
  NEARBY_HELP: '#0D9488',
  SILENT_RECORDING: '#BE123C',
  SAFE_CHECKIN: '#0284C7',
  INCIDENT_REPORT: '#D97706',
} as const;

export const HELP_CATEGORY_COLORS = {
  POLICE: '#1890FF',
  HOSPITAL: '#F5222D',
  FIRE_STATION: '#FA8C16',
  PHARMACY: '#52C41A',
} as const;

export type ColorKey = keyof typeof COLORS;
