import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import NearbyHelpScreen from '@app/nearby-help';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockGetCurrentLocation = jest.fn();
const mockFetchNearbyPlaces = jest.fn();
jest.mock('@/services/location.service', () => ({
  getCurrentLocation: () => mockGetCurrentLocation(),
  fetchNearbyPlaces: (lat: number, lng: number, type: string) =>
    mockFetchNearbyPlaces(lat, lng, type),
}));

describe('NearbyHelpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentLocation.mockResolvedValue({ latitude: 19, longitude: 72, timestamp: 0 });
    mockFetchNearbyPlaces.mockResolvedValue([]);
  });

  it('renders the four help-category tabs and loads places', async () => {
    const { getByText } = await render(<NearbyHelpScreen />);
    expect(getByText('Police Stations')).toBeTruthy();
    expect(getByText('Hospitals')).toBeTruthy();
    expect(getByText('Fire Stations')).toBeTruthy();
    expect(getByText('Pharmacies')).toBeTruthy();
    await waitFor(() => expect(mockFetchNearbyPlaces).toHaveBeenCalledTimes(4));
  });

  it('switches the active category on tab press', async () => {
    const { getByText } = await render(<NearbyHelpScreen />);
    await waitFor(() => expect(mockFetchNearbyPlaces).toHaveBeenCalled());
    await fireEvent.press(getByText('Hospitals'));
    expect(getByText('No places found nearby')).toBeTruthy();
  });

  it('shows the error state with a retry when loading fails', async () => {
    mockGetCurrentLocation.mockRejectedValueOnce(new Error('errors.locationPermissionDenied'));
    const { getByText } = await render(<NearbyHelpScreen />);
    await waitFor(() =>
      expect(
        getByText('Could not load nearby places. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    await fireEvent.press(getByText('Try again'));
  });
});
