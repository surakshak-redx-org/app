import * as Location from 'expo-location';

import {
  extendLiveLocationSession,
  startLiveLocationSession,
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import {
  getNearbyUnsafeAreas,
  reportUnsafeArea,
  voteOnUnsafeArea,
} from '@/services/firebase/unsafe-areas.service';
import {
  buildLocationUrl,
  findNearbyPlaces,
  getCurrentLocation,
  reverseGeocode,
  watchLocation,
} from '@/services/location.service';

describe('location.service stubs', () => {
  it.each([
    ['reverseGeocode', () => reverseGeocode(19.076, 72.8777)],
    ['findNearbyPlaces', () => findNearbyPlaces(19.076, 72.8777, 'police')],
  ])('%s rejects until its phase lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });

  it('watchLocation throws synchronously — it returns an unsubscribe, not a promise', () => {
    expect(() => watchLocation(jest.fn())).toThrow('Not implemented');
  });
});

describe('getCurrentLocation', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest
      .mocked(Location.requestForegroundPermissionsAsync)
      .mockResolvedValue({ granted: true } as never);
  });

  afterEach(() => errorSpy.mockRestore());

  it('returns a LocationData shape when permission is granted', async () => {
    const result = await getCurrentLocation();
    expect(result).toEqual({
      latitude: 19.076,
      longitude: 72.8777,
      timestamp: 1_700_000_000_000,
      accuracy: 5,
    });
  });

  it('omits accuracy when the platform does not report it', async () => {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValueOnce({
      coords: { latitude: 1, longitude: 2, accuracy: null },
      timestamp: 5,
    } as never);

    const result = await getCurrentLocation();
    expect(result).not.toHaveProperty('accuracy');
  });

  it('rejects with the i18n key when permission is denied', async () => {
    jest
      .mocked(Location.requestForegroundPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);

    await expect(getCurrentLocation()).rejects.toThrow('errors.locationPermissionDenied');
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('buildLocationUrl', () => {
  it('formats the canonical maps place link', () => {
    expect(buildLocationUrl(19.076, 72.8777)).toBe(
      'https://www.google.com/maps/place/19.076,72.8777',
    );
  });
});

describe('live-location.service stubs', () => {
  it.each([
    ['startLiveLocationSession', () => startLiveLocationSession('user-1', ['user-2'], 1)],
    ['updateLiveLocation', () => updateLiveLocation('session-1', 19.076, 72.8777)],
    ['stopLiveLocationSession', () => stopLiveLocationSession('session-1')],
    ['extendLiveLocationSession', () => extendLiveLocationSession('session-1', 1)],
  ])('%s rejects until Phase 4 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});

describe('unsafe-areas.service stubs', () => {
  it.each([
    ['getNearbyUnsafeAreas', () => getNearbyUnsafeAreas(19.076, 72.8777, 50)],
    ['voteOnUnsafeArea', () => voteOnUnsafeArea('area-1', 'user-1', true)],
    [
      'reportUnsafeArea',
      () =>
        reportUnsafeArea('user-1', {
          reportedBy: 'user-1',
          latitude: 19.076,
          longitude: 72.8777,
          radiusMeters: 100,
          title: 'Dark lane',
          description: 'No street lights',
          category: 'poorly_lit',
          pinColor: 'orange',
        }),
    ],
  ])('%s rejects until Phase 4 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
