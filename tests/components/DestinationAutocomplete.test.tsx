import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { DestinationAutocomplete } from '@/components/features/location/DestinationAutocomplete';

const mockAutocomplete = jest.fn();
const mockGetPlaceLocation = jest.fn();
jest.mock('@/services/location.service', () => ({
  autocompletePlaces: (input: string, bias: unknown) => mockAutocomplete(input, bias),
  getPlaceLocation: (placeId: string) => mockGetPlaceLocation(placeId),
}));

describe('DestinationAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAutocomplete.mockResolvedValue([
      { placeId: 'p1', primaryText: 'Andheri Station', secondaryText: 'Mumbai' },
    ]);
    mockGetPlaceLocation.mockResolvedValue({
      name: 'Andheri Station',
      latitude: 19.11,
      longitude: 72.84,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('queries after the debounce and resolves the picked place', async () => {
    const onChangeText = jest.fn();
    const onSelectPlace = jest.fn();

    const { getByPlaceholderText, findByText } = await render(
      <DestinationAutocomplete
        value="Andheri"
        onChangeText={onChangeText}
        onSelectPlace={onSelectPlace}
      />,
    );

    // Nothing fires below the debounce window.
    expect(mockAutocomplete).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockAutocomplete).toHaveBeenCalledWith('Andheri', undefined));

    await act(async () => {
      await fireEvent.press(await findByText('Andheri Station'));
    });

    expect(onChangeText).toHaveBeenCalledWith('Andheri Station');
    await waitFor(() =>
      expect(onSelectPlace).toHaveBeenCalledWith({
        name: 'Andheri Station',
        latitude: 19.11,
        longitude: 72.84,
      }),
    );

    // The input keeps forwarding keystrokes.
    await fireEvent.changeText(getByPlaceholderText('Where are you going?'), 'Bandra');
    expect(onChangeText).toHaveBeenLastCalledWith('Bandra');
  });

  it('does not query for inputs shorter than the minimum', async () => {
    await render(
      <DestinationAutocomplete value="an" onChangeText={jest.fn()} onSelectPlace={jest.fn()} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });
});
