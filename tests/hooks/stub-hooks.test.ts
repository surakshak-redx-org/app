import { act, renderHook } from '@testing-library/react-native';

import { APP_CONFIG } from '@/constants/config';
import { useBatteryAlert } from '@/hooks/useBatteryAlert';
import { useCommunity } from '@/hooks/useCommunity';
import { useFakeCall } from '@/hooks/useFakeCall';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { useLocation } from '@/hooks/useLocation';
import { useShakeDetection } from '@/hooks/useShakeDetection';
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

  it('reports permission as not yet granted until Phase 4', async () => {
    const { result } = await renderHook(() => useLocation());
    await expect(result.current.requestPermission()).resolves.toBe(false);
  });
});

describe('useShakeDetection', () => {
  it('starts disabled and can be toggled', async () => {
    const { result } = await renderHook(() => useShakeDetection());
    expect(result.current.isEnabled).toBe(false);

    await act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.isEnabled).toBe(true);
  });
});

describe('useBatteryAlert', () => {
  it('defaults to the configured threshold', async () => {
    const { result } = await renderHook(() => useBatteryAlert());
    expect(result.current.threshold).toBe(APP_CONFIG.LOW_BATTERY_THRESHOLD_PERCENT);
    expect(result.current.isEnabled).toBe(false);
  });

  it('accepts a new threshold', async () => {
    const { result } = await renderHook(() => useBatteryAlert());

    await act(() => {
      result.current.setThreshold(15);
    });
    expect(result.current.threshold).toBe(15);
  });
});

describe('useLiveLocation', () => {
  beforeEach(() => useLocationStore.getState().reset());

  it('starts inactive', async () => {
    const { result } = await renderHook(() => useLiveLocation());
    expect(result.current.isActive).toBe(false);
    expect(result.current.sessionId).toBeNull();
  });

  it('rejects its Phase 4 actions', async () => {
    const { result } = await renderHook(() => useLiveLocation());

    await expect(result.current.startSharing([], 1)).rejects.toThrow('Not implemented');
    await expect(result.current.stopSharing()).rejects.toThrow('Not implemented');
    await expect(result.current.extendTime(1)).rejects.toThrow('Not implemented');
  });
});

describe('useCommunity', () => {
  it('starts with an empty feed and rejects its Phase 5 actions', async () => {
    const { result } = await renderHook(() => useCommunity());

    expect(result.current.posts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    await expect(
      result.current.createPost({
        content: 'hi',
        type: 'text',
        isAnonymous: false,
        city: 'Mumbai',
        state: 'MH',
      }),
    ).rejects.toThrow('Not implemented');
    await expect(result.current.reportPost('post-1')).rejects.toThrow('Not implemented');
  });
});

describe('useFakeCall', () => {
  it('starts with no active call and rejects its Phase 7 actions', async () => {
    const { result } = await renderHook(() => useFakeCall());

    expect(result.current.isCallActive).toBe(false);
    await expect(result.current.scheduleCall(30, 'Mom')).rejects.toThrow('Not implemented');
    await expect(result.current.cancelCall()).rejects.toThrow('Not implemented');
  });

  it('ending a call is safe even when none is active', async () => {
    const { result } = await renderHook(() => useFakeCall());

    await act(() => {
      result.current.endCall();
    });
    expect(result.current.isCallActive).toBe(false);
  });
});
