import * as Location from 'expo-location';

import {
  buildLocationUrl,
  fetchNearbyPlaces,
  getCurrentLocation,
  reverseGeocode,
  watchLocation,
} from '@/services/location.service';

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

describe('watchLocation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an unsubscribe function and never throws synchronously', () => {
    const unsubscribe = watchLocation(jest.fn());
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('forwards each fix to the callback', async () => {
    const onChange = jest.fn();
    jest.mocked(Location.watchPositionAsync).mockImplementationOnce((_options, listener) => {
      (listener as (p: unknown) => void)({
        coords: { latitude: 1, longitude: 2, accuracy: 3 },
        timestamp: 9,
      });
      return Promise.resolve({ remove: jest.fn() });
    });

    watchLocation(onChange);
    await Promise.resolve();

    expect(onChange).toHaveBeenCalledWith({
      latitude: 1,
      longitude: 2,
      timestamp: 9,
      accuracy: 3,
    });
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps the first result to city and state', async () => {
    const result = await reverseGeocode(19.076, 72.8777);
    expect(result).toEqual({ city: 'Mumbai', state: 'Maharashtra' });
  });
});

describe('fetchNearbyPlaces', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  afterAll(() => errorSpy.mockRestore());
  beforeEach(() => jest.clearAllMocks());

  function mockPlacesResponse(ok: boolean, body: unknown): void {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok, json: () => Promise.resolve(body) }),
    ) as unknown as typeof fetch;
  }

  it('returns places sorted by ascending distance from the user', async () => {
    mockPlacesResponse(true, {
      status: 'OK',
      results: [
        {
          place_id: 'far',
          name: 'Far station',
          vicinity: 'Far road',
          geometry: { location: { lat: 19.2, lng: 72.9 } },
        },
        {
          place_id: 'near',
          name: 'Near station',
          vicinity: 'Near road',
          geometry: { location: { lat: 19.08, lng: 72.88 } },
          opening_hours: { open_now: true },
        },
      ],
    });

    const result = await fetchNearbyPlaces(19.076, 72.8777, 'police');

    expect(result.map((place) => place.id)).toEqual(['near', 'far']);
    expect(result[0]?.isOpen).toBe(true);
    expect(result[1]?.isOpen).toBeNull();
    expect(result[0]?.distanceKm).toBeLessThan(result[1]?.distanceKm ?? Infinity);
  });

  it('throws when the HTTP response is not ok', async () => {
    mockPlacesResponse(false, {});
    await expect(fetchNearbyPlaces(19.076, 72.8777, 'hospital')).rejects.toThrow(
      'errors.networkError',
    );
  });

  it('throws when the Places API rejects the request', async () => {
    mockPlacesResponse(true, { status: 'REQUEST_DENIED', results: [], error_message: 'bad key' });
    await expect(fetchNearbyPlaces(19.076, 72.8777, 'pharmacy')).rejects.toThrow('bad key');
  });

  it('treats ZERO_RESULTS as an empty list, not an error', async () => {
    mockPlacesResponse(true, { status: 'ZERO_RESULTS', results: [] });
    await expect(fetchNearbyPlaces(19.076, 72.8777, 'fire_station')).resolves.toEqual([]);
  });
});
