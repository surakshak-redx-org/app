import { renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { COLORS } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

describe('useTheme', () => {
  let colorSchemeSpy: jest.SpyInstance;

  afterEach(() => colorSchemeSpy.mockRestore());

  it('returns isDark=false and light colors in light mode', async () => {
    colorSchemeSpy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');

    const { result } = await renderHook(() => useTheme());

    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.background).toBe(COLORS.OFF_WHITE);
  });

  it('returns isDark=true and dark colors in dark mode', async () => {
    colorSchemeSpy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme());

    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.background).toBe(COLORS.NEAR_BLACK);
  });

  it('treats an unspecified system scheme as light', async () => {
    colorSchemeSpy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('unspecified');

    const { result } = await renderHook(() => useTheme());

    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.tabBar).toBe(COLORS.WHITE);
  });
});
