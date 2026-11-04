import { act, fireEvent, render } from '@testing-library/react-native';
import * as mockReact from 'react';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import MapScreen from '@app/(tabs)/map';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)): void => {
    mockReact.useEffect(() => {
      return cb();
    }, [cb]);
  },
}));

const mockPlaceCall = jest.fn((_phone: string) => Promise.resolve());
jest.mock('@/utils/phone.utils', () => ({
  placeCall: (phone: string) => mockPlaceCall(phone),
}));

const MOCK_NEARBY_PLACES = [
  {
    id: 'p1',
    name: 'Central Police Station',
    address: '123 Police Road',
    latitude: 19.01,
    longitude: 72.01,
    isOpen: true,
    distanceKm: 0.45,
    phoneNumber: '0221234567',
  },
  {
    id: 'h1',
    name: 'City Care Hospital',
    address: '456 Hospital Lane',
    latitude: 19.02,
    longitude: 72.02,
    isOpen: true,
    distanceKm: 1.2,
    phoneNumber: '0227654321',
  },
];

const mockFetchNearbyPlaces = jest.fn((_lat: number, _lon: number, category: string) => {
  if (category === 'police') return Promise.resolve([MOCK_NEARBY_PLACES[0]]);
  if (category === 'hospital') return Promise.resolve([MOCK_NEARBY_PLACES[1]]);
  return Promise.resolve([]);
});

jest.mock('@/services/location.service', () => ({
  fetchNearbyPlaces: (lat: number, lon: number, cat: string) =>
    mockFetchNearbyPlaces(lat, lon, cat),
  getFreshLocation: jest.fn(() => Promise.resolve({ latitude: 19, longitude: 72 })),
  getCurrentLocation: jest.fn(() => Promise.resolve({ latitude: 19, longitude: 72 })),
}));

const mockSubscribe = jest.fn((_cb: (areas: unknown[]) => void) => jest.fn());
jest.mock('@/services/firebase/unsafe-areas.service', () => ({
  subscribeToUnsafeAreas: (cb: (areas: unknown[]) => void) => mockSubscribe(cb),
  reportUnsafeArea: jest.fn(() => Promise.resolve('area-1')),
  voteOnUnsafeArea: jest.fn(() => Promise.resolve()),
}));

describe('MapScreen', () => {
  it('renders the map heading', async () => {
    const { getByText } = await render(<MapScreen />);
    expect(getByText('Safety Map')).toBeTruthy();
  });

  it('subscribes to unsafe areas and renders the report action', async () => {
    const { getByLabelText } = await render(<MapScreen />);
    expect(mockSubscribe).toHaveBeenCalled();
    expect(getByLabelText('Report Unsafe Area')).toBeTruthy();
  });

  it('toggles the legend and gates the report action behind sign-in', async () => {
    const { getByLabelText, getByText } = await render(<MapScreen />);
    await fireEvent.press(getByLabelText('Map Legend'));
    expect(getByText('Reported — pending review')).toBeTruthy();
    // A guest tapping report gets the sign-in prompt, not the modal.
    await fireEvent.press(getByLabelText('Report Unsafe Area'));
  });

  function area(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'a1',
      reportedBy: 'u9',
      latitude: 19,
      longitude: 72,
      radiusMeters: 200,
      title: 'Dark lane',
      description: 'No street lights after 8pm',
      category: 'poorly_lit',
      status: 'approved',
      pinColor: 'red',
      upvotes: 2,
      downvotes: 0,
      voterIds: [],
      ...overrides,
    };
  }

  it('keeps the open area card in sync with live vote counts', async () => {
    let push: (areas: unknown[]) => void = () => undefined;
    mockSubscribe.mockImplementationOnce((cb) => {
      push = cb;
      return jest.fn();
    });
    const { getByTestId, getByText, findByText } = await render(<MapScreen />);

    await act(() => push([area()]));
    await fireEvent.press(getByTestId('unsafe-area-a1'));
    expect(getByText('Dark lane')).toBeTruthy();
    expect(getByText('2 votes')).toBeTruthy();

    await act(() => push([area({ upvotes: 3 })]));
    expect(await findByText('3 votes')).toBeTruthy();
  });

  it('hides the report button while an area card is open', async () => {
    let push: (areas: unknown[]) => void = () => undefined;
    mockSubscribe.mockImplementationOnce((cb) => {
      push = cb;
      return jest.fn();
    });
    const { getByTestId, queryByLabelText } = await render(<MapScreen />);

    await act(() => push([area()]));
    await fireEvent.press(getByTestId('unsafe-area-a1'));

    expect(queryByLabelText('Report Unsafe Area')).toBeNull();
  });

  it('disables voting once the signed-in user has voted', async () => {
    useAuthStore.setState({ user: { uid: 'u1' } as never, isGuest: false });
    let push: (areas: unknown[]) => void = () => undefined;
    mockSubscribe.mockImplementationOnce((cb) => {
      push = cb;
      return jest.fn();
    });
    const { getByTestId, getByLabelText } = await render(<MapScreen />);

    await act(() => push([area({ voterIds: ['u1'] })]));
    await fireEvent.press(getByTestId('unsafe-area-a1'));

    expect(getByLabelText('Upvote').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('renders cached unsafe areas instantly on mount from useLocationStore', async () => {
    useLocationStore
      .getState()
      .setCachedUnsafeAreas([area({ id: 'cached-1', title: 'Cached Hazard' }) as never]);

    const { getByTestId, getByText } = await render(<MapScreen />);
    expect(getByTestId('unsafe-area-cached-1')).toBeTruthy();
    await fireEvent.press(getByTestId('unsafe-area-cached-1'));
    expect(getByText('Cached Hazard')).toBeTruthy();
  });

  it('animates camera when currentLocation is acquired', async () => {
    useLocationStore.getState().setCurrentLocation({
      latitude: 18.5204,
      longitude: 73.8567,
      timestamp: 123456,
    });
    const { getByText } = await render(<MapScreen />);
    expect(getByText('Safety Map')).toBeTruthy();
  });

  it('renders nearby help bottom sheet with facility summary and Call 112 button', async () => {
    useLocationStore.getState().setCurrentLocation({
      latitude: 19.0,
      longitude: 72.0,
      timestamp: 123456,
    });
    const { findByText, getByLabelText } = await render(<MapScreen />);

    expect(await findByText('Nearest: 450m Police • 1.2km Hospital')).toBeTruthy();

    await fireEvent.press(getByLabelText('Call 112'));
    expect(mockPlaceCall).toHaveBeenCalledWith('112');
  });

  it('switches nearby help categories and renders places with Call and Directions', async () => {
    const { Linking } = jest.requireActual<typeof import('react-native')>('react-native');
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    useLocationStore.getState().setCurrentLocation({
      latitude: 19.0,
      longitude: 72.0,
      timestamp: 123456,
    });

    const { findByText, getByLabelText, getByTestId } = await render(<MapScreen />);

    // Initial police category
    expect(await findByText('Central Police Station')).toBeTruthy();
    expect(getByTestId('nearby-marker-p1')).toBeTruthy();

    // Call Central Police Station
    await fireEvent.press(getByLabelText('Call Central Police Station'));
    expect(mockPlaceCall).toHaveBeenCalledWith('0221234567');

    // Directions to Central Police Station
    await fireEvent.press(getByLabelText('Directions Central Police Station'));
    expect(openURLSpy).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=19.01,72.01',
    );

    // Switch to Hospitals
    await fireEvent.press(getByLabelText('Hospitals'));
    expect(await findByText('City Care Hospital')).toBeTruthy();
    expect(getByTestId('nearby-marker-h1')).toBeTruthy();

    openURLSpy.mockRestore();
  });
});
