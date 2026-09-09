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
  findNearbyPlaces,
  getCurrentLocation,
  reverseGeocode,
  watchLocation,
} from '@/services/location.service';

describe('location.service stubs', () => {
  it.each([
    ['getCurrentLocation', () => getCurrentLocation()],
    ['reverseGeocode', () => reverseGeocode(19.076, 72.8777)],
    ['findNearbyPlaces', () => findNearbyPlaces(19.076, 72.8777, 'police')],
  ])('%s rejects until its phase lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });

  it('watchLocation throws synchronously — it returns an unsubscribe, not a promise', () => {
    expect(() => watchLocation(jest.fn())).toThrow('Not implemented');
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
