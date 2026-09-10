import { act, renderHook } from '@testing-library/react-native';

import { useLiveLocation } from '@/hooks/useLiveLocation';
import { useLocation } from '@/hooks/useLocation';
import { useLocationStore } from '@/stores/location.store';

describe('useLocation', () => {
  beforeEach(() => useLocationStore.getState().reset());

  it('returns a null URL with no fix yet', async () => {
    const { result } = await renderHook(() => useLocation());
    expect(result.current.getLocationUrl()).toBeNull();
  });

  it('builds the share URL once a position is known', async () => {
    await act(() => {
      useLocationStore.getState().setCurrentLocation({
        latitude: 19.076,
        longitude: 72.8777,
        timestamp: 1,
      });
    });

    const { result } = await renderHook(() => useLocation());
    expect(result.current.getLocationUrl()).toBe(
      'https://www.google.com/maps/place/19.076,72.8777',
    );
  });

  it('reports permission as denied when the OS prompt is declined', async () => {
    const { result } = await renderHook(() => useLocation());
    await expect(result.current.requestPermission()).resolves.toBe(false);
  });
});

describe('useLiveLocation', () => {
  beforeEach(() => useLocationStore.getState().reset());

  it('starts inactive', async () => {
    const { result } = await renderHook(() => useLiveLocation());
    expect(result.current.isActive).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.expiresAt).toBeNull();
  });

  it('refuses to start sharing without an authenticated user', async () => {
    const { result } = await renderHook(() => useLiveLocation());
    await expect(result.current.startSharing([], 1)).rejects.toThrow('Not authenticated');
  });

  it('no-ops stop / extend when there is no active session', async () => {
    const { result } = await renderHook(() => useLiveLocation());
    await expect(result.current.stopSharing()).resolves.toBeUndefined();
    await expect(result.current.extendTime(1)).resolves.toBeUndefined();
  });
});
