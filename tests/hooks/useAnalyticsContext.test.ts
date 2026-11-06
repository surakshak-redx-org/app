import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useAnalyticsContext } from '@/hooks/useAnalyticsContext';
import {
  setAnalyticsSuperProperties,
  setAnalyticsUserProperties,
} from '@/services/analytics.service';
import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/user.types';

jest.mock('@/services/analytics.service', () => ({
  setAnalyticsSuperProperties: jest.fn(),
  setAnalyticsUserProperties: jest.fn(),
}));

describe('useAnalyticsContext', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    jest.clearAllMocks();
  });

  it('registers the app environment, version and platform on every event', async () => {
    await renderHook(() => useAnalyticsContext());

    expect(setAnalyticsSuperProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        app_env: 'dev',
        app_version: expect.stringMatching(/^\d+\.\d+\.\d+$/) as unknown,
        platform: Platform.OS,
      }),
    );
  });

  it('puts version and platform on the profile as well', async () => {
    await renderHook(() => useAnalyticsContext());

    expect(setAnalyticsUserProperties).toHaveBeenCalledWith(
      expect.objectContaining({ platform: Platform.OS }),
    );
  });

  it('reports a non-guest with no language until the profile loads', async () => {
    await renderHook(() => useAnalyticsContext());

    expect(setAnalyticsSuperProperties).toHaveBeenCalledWith({ is_guest: false });
  });

  it('adds the language once the profile loads', async () => {
    await renderHook(() => useAnalyticsContext());
    await act(() => {
      useAuthStore.getState().setSurakshakUser({ language: 'mr' } as User);
    });

    expect(setAnalyticsSuperProperties).toHaveBeenLastCalledWith({
      is_guest: false,
      language: 'mr',
    });
    expect(setAnalyticsUserProperties).toHaveBeenLastCalledWith({
      is_guest: false,
      language: 'mr',
    });
  });

  it('flags guests', async () => {
    await renderHook(() => useAnalyticsContext());
    await act(() => {
      useAuthStore.getState().setGuest(true);
    });

    expect(setAnalyticsSuperProperties).toHaveBeenLastCalledWith({ is_guest: true });
  });

  it('never sets a name, phone number or location', async () => {
    await renderHook(() => useAnalyticsContext());
    await act(() => {
      useAuthStore.getState().setSurakshakUser({
        name: 'Asha',
        phone: '+919876543210',
        city: 'Pune',
        language: 'en',
      } as User);
    });

    const everything = JSON.stringify([
      jest.mocked(setAnalyticsSuperProperties).mock.calls,
      jest.mocked(setAnalyticsUserProperties).mock.calls,
    ]);
    expect(everything).not.toContain('Asha');
    expect(everything).not.toContain('9876543210');
    expect(everything).not.toContain('Pune');
  });
});
