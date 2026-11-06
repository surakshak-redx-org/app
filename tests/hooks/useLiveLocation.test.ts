import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { ENV } from '@/config/env';
import { STORAGE_KEYS } from '@/constants/storage';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { trackLiveLocationExpired, trackLiveLocationStopped } from '@/services/analytics.service';
import {
  createLiveLocationSession,
  extendLiveLocationSession,
  getActiveLiveSession,
  revokeShareToken,
  stopLiveLocationSession,
} from '@/services/firebase/live-location.service';
import { getCurrentLocation, watchLocation } from '@/services/location.service';
import { sendLiveLocationShare } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';

jest.mock('@/services/analytics.service', () => ({
  trackLiveLocationStarted: jest.fn(),
  trackLiveLocationStopped: jest.fn(),
  trackLiveLocationExtended: jest.fn(),
  trackLiveLocationExpired: jest.fn(),
}));

jest.mock('@/services/firebase/live-location.service', () => ({
  createLiveLocationSession: jest.fn(() => Promise.resolve('session-1')),
  extendLiveLocationSession: jest.fn(() => Promise.resolve()),
  stopLiveLocationSession: jest.fn(() => Promise.resolve()),
  revokeShareToken: jest.fn(() => Promise.resolve()),
  updateLiveLocation: jest.fn(() => Promise.resolve()),
  getActiveLiveSession: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/utils/tracking.utils', () => ({
  ...jest.requireActual<typeof import('@/utils/tracking.utils')>('@/utils/tracking.utils'),
  generateShareToken: jest.fn(() => Promise.resolve('abcd1234')),
}));

jest.mock('@/services/location.service', () => ({
  getCurrentLocation: jest.fn(() =>
    Promise.resolve({ latitude: 19.076, longitude: 72.8777, timestamp: 1 }),
  ),
  watchLocation: jest.fn(() => jest.fn()),
}));

jest.mock('@/services/sms.service', () => ({
  sendLiveLocationShare: jest.fn(() => Promise.resolve({ sent: ['+919000000000'], failed: [] })),
  recordSMSAlert: jest.fn(() => Promise.resolve()),
}));

const authState = useAuthStore.getState();

describe('useLiveLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.getState().reset();
    useAuthStore.setState({
      ...authState,
      surakshakUser: {
        userId: 'u1',
        name: 'Asha',
        phone: '9000000000',
        profilePhotoUrl: '',
        city: 'Mumbai',
        state: 'MH',
        language: 'en',
        isGuest: false,
        createdAt: null as never,
        updatedAt: null as never,
      },
    });
  });

  it('startSharing creates a session with the selected contacts and duration', async () => {
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.startSharing(['c1', 'c2'], 4);
    });

    expect(createLiveLocationSession).toHaveBeenCalledWith(
      'u1',
      ['c1', 'c2'],
      4,
      19.076,
      72.8777,
      expect.any(String),
      'abcd1234',
      undefined,
    );
    expect(getCurrentLocation).toHaveBeenCalled();
    // No tracking page is configured in tests, so the SMS falls back to a static pin.
    expect(sendLiveLocationShare).toHaveBeenCalledWith(
      expect.anything(),
      'https://www.google.com/maps/place/19.076,72.8777',
      'Asha',
      expect.any(String),
      'en',
    );
    expect(useLocationStore.getState().isLiveLocationActive).toBe(true);
    expect(useLocationStore.getState().liveLocationSessionId).toBe('session-1');
  });

  it('does not rehydrate session belonging to another device (BUG-136)', async () => {
    jest.mocked(getActiveLiveSession).mockResolvedValueOnce({
      id: 'foreign-session',
      userId: 'u1',
      deviceId: 'different-device-123',
      isActive: true,
      expiresAt: { toDate: () => new Date(Date.now() + 3600000) },
      sharedWithUserIds: ['c1'],
    } as never);

    await renderHook(() => useLiveLocation());

    expect(useLocationStore.getState().isLiveLocationActive).toBe(false);
    expect(useLocationStore.getState().liveLocationSessionId).toBeNull();
  });

  it('stopSharing ends the session and clears the store', async () => {
    useLocationStore.getState().setLiveLocationActive(true, 'session-1');
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(stopLiveLocationSession).toHaveBeenCalledWith('session-1');
    expect(useLocationStore.getState().isLiveLocationActive).toBe(false);
    expect(useLocationStore.getState().liveLocationSessionId).toBeNull();
    expect(trackLiveLocationStopped).toHaveBeenCalledTimes(1);
    expect(trackLiveLocationExpired).not.toHaveBeenCalled();
  });

  it('stopSharing("expired") reports an expiry, not a user stop', async () => {
    useLocationStore.getState().setLiveLocationActive(true, 'session-1');
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.stopSharing('expired');
    });

    expect(stopLiveLocationSession).toHaveBeenCalledWith('session-1');
    expect(trackLiveLocationExpired).toHaveBeenCalledTimes(1);
    expect(trackLiveLocationStopped).not.toHaveBeenCalled();
  });

  it('extendTime extends the active session', async () => {
    useLocationStore.getState().setLiveLocationActive(true, 'session-1');
    jest
      .mocked(getActiveLiveSession)
      .mockResolvedValueOnce({ expiresAt: { toDate: () => new Date() } } as never);
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.extendTime(1);
    });

    expect(extendLiveLocationSession).toHaveBeenCalledWith('session-1', 1);
  });

  it('falls back to foreground-only tracking when background permission is denied', async () => {
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.startSharing(['c1'], 1);
    });

    expect(result.current.foregroundOnly).toBe(true);
    // Updates then come from the foreground watch instead.
    expect(watchLocation).toHaveBeenCalledTimes(1);
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    // The session and SMS still go out; only the background task is skipped.
    expect(sendLiveLocationShare).toHaveBeenCalled();
  });

  it('starts the background task at the walking profile when permission is granted', async () => {
    jest
      .mocked(Location.requestBackgroundPermissionsAsync)
      .mockResolvedValueOnce({ granted: true } as never);
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.startSharing(['c1'], 1);
    });

    expect(result.current.foregroundOnly).toBe(false);
    expect(watchLocation).not.toHaveBeenCalled();
    expect(result.current.trackingProfile).toBe('walking');
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'surakshak-live-location',
      expect.objectContaining({ timeInterval: 20_000, distanceInterval: 15 }),
    );
  });

  it('startSharing saves the destination for arrival detection', async () => {
    const { result } = await renderHook(() => useLiveLocation());
    const destination = { name: 'Home', latitude: 19.1, longitude: 72.9 };

    await act(async () => {
      await result.current.startSharing(['c1'], 1, destination);
    });

    expect(createLiveLocationSession).toHaveBeenCalledWith(
      'u1',
      ['c1'],
      1,
      19.076,
      72.8777,
      expect.any(String),
      'abcd1234',
      destination,
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.LIVE_LOCATION_DESTINATION,
      JSON.stringify(destination),
    );
    expect(result.current.destination).toEqual(destination);
  });

  it('startSharing without a destination clears any leftover one', async () => {
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.startSharing(['c1'], 1);
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LIVE_LOCATION_DESTINATION);
    expect(result.current.destination).toBeNull();
  });

  it('restores the destination of a running session', async () => {
    jest.mocked(getActiveLiveSession).mockResolvedValueOnce({
      id: 'session-9',
      userId: 'u1',
      isActive: true,
      expiresAt: { toDate: () => new Date(Date.now() + 3_600_000) },
      sharedWithUserIds: ['c1'],
      destination: { name: 'Office', latitude: 19.2, longitude: 72.95 },
    } as never);

    const { result } = await renderHook(() => useLiveLocation());

    await waitFor(() => expect(result.current.destination?.name).toBe('Office'));
    expect(AsyncStorage.multiSet).toHaveBeenCalledWith(
      expect.arrayContaining([
        [
          STORAGE_KEYS.LIVE_LOCATION_DESTINATION,
          JSON.stringify({ name: 'Office', latitude: 19.2, longitude: 72.95 }),
        ],
      ]),
    );
  });

  describe('tracking link', () => {
    const BASE_URL = 'https://track.example.com/track';

    afterEach(() => {
      Object.assign(ENV, { TRACKING_BASE_URL: undefined });
    });

    it('reports the link as unavailable when no tracking page is configured', async () => {
      const { result } = await renderHook(() => useLiveLocation());

      await act(async () => {
        await result.current.startSharing(['c1'], 1);
      });

      expect(result.current.linkStatus).toBe('unavailable');
      expect(result.current.trackingUrl).toBeNull();
    });

    it('texts contacts the tracking link and exposes it for copying and sharing', async () => {
      Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
      const { result } = await renderHook(() => useLiveLocation());

      await act(async () => {
        await result.current.startSharing(['c1'], 1);
      });

      expect(sendLiveLocationShare).toHaveBeenCalledWith(
        expect.anything(),
        `${BASE_URL}/abcd1234`,
        'Asha',
        expect.any(String),
        'en',
      );
      expect(result.current.trackingUrl).toBe(`${BASE_URL}/abcd1234`);
      expect(result.current.linkStatus).toBe('active');
    });

    it('revokeLink removes the token but keeps the session running', async () => {
      Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
      const { result } = await renderHook(() => useLiveLocation());
      await act(async () => {
        await result.current.startSharing(['c1'], 1);
      });

      await act(async () => {
        await result.current.revokeLink();
      });

      expect(revokeShareToken).toHaveBeenCalledWith('session-1');
      expect(result.current.trackingUrl).toBeNull();
      expect(result.current.linkStatus).toBe('revoked');
      expect(result.current.isActive).toBe(true);
    });

    it('keeps the link active when revoking fails', async () => {
      Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
      const { result } = await renderHook(() => useLiveLocation());
      await act(async () => {
        await result.current.startSharing(['c1'], 1);
      });
      jest.mocked(revokeShareToken).mockRejectedValueOnce(new Error('offline'));

      await act(async () => {
        await expect(result.current.revokeLink()).rejects.toThrow('offline');
      });

      expect(result.current.linkStatus).toBe('active');
      expect(result.current.trackingUrl).toBe(`${BASE_URL}/abcd1234`);
    });

    it('does nothing when there is no session to revoke', async () => {
      const { result } = await renderHook(() => useLiveLocation());

      await act(async () => {
        await result.current.revokeLink();
      });

      expect(revokeShareToken).not.toHaveBeenCalled();
    });

    it('restores the link of a running session', async () => {
      Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
      jest.mocked(getActiveLiveSession).mockResolvedValueOnce({
        id: 'session-9',
        userId: 'u1',
        isActive: true,
        expiresAt: { toDate: () => new Date(Date.now() + 3_600_000) },
        sharedWithUserIds: ['c1'],
        shareToken: 'feedface',
      } as never);

      const { result } = await renderHook(() => useLiveLocation());

      await waitFor(() => expect(result.current.trackingUrl).toBe(`${BASE_URL}/feedface`));
      expect(result.current.linkStatus).toBe('active');
    });

    it('forgets the link when sharing stops', async () => {
      Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
      const { result } = await renderHook(() => useLiveLocation());
      await act(async () => {
        await result.current.startSharing(['c1'], 1);
      });

      await act(async () => {
        await result.current.stopSharing();
      });

      expect(result.current.trackingUrl).toBeNull();
    });
  });

  it('stopSharing forgets the destination', async () => {
    useLocationStore.getState().setLiveLocationActive(true, 'session-1');
    const { result } = await renderHook(() => useLiveLocation());
    await act(async () => {
      await result.current.startSharing(['c1'], 1, { name: 'Home', latitude: 1, longitude: 2 });
    });

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(result.current.destination).toBeNull();
  });

  it('stopSharing clears the persisted tracking state', async () => {
    useLocationStore.getState().setLiveLocationActive(true, 'session-1');
    const { result } = await renderHook(() => useLiveLocation());

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE]),
    );
  });
});
