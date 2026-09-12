import { useColorScheme } from 'react-native';

import { COLORS } from '@/constants/colors';

export interface Theme {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    tabBar: string;
  };
}

/**
 * For components that set a color via a prop or inline style rather than a
 * NativeWind `className` — e.g. the tab bar's `screenOptions.tabBarStyle`,
 * which React Navigation reads directly, not through Tailwind. Everywhere a
 * `dark:` class variant works, prefer that over this hook — it tracks the
 * same system `prefers-color-scheme` NativeWind's `dark:` variants use.
 */
export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: {
      background: isDark ? COLORS.NEAR_BLACK : COLORS.OFF_WHITE,
      surface: isDark ? COLORS.CHARCOAL : COLORS.WHITE,
      border: isDark ? COLORS.DARK_BORDER : '#E5E7EB',
      textPrimary: isDark ? COLORS.DARK_TEXT_PRIMARY : COLORS.DEEP_INK,
      textSecondary: isDark ? COLORS.DARK_TEXT_SECONDARY : COLORS.STONE,
      tabBar: isDark ? COLORS.CHARCOAL : COLORS.WHITE,
    },
  };
}
