import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import MapScreen from '@app/(tabs)/map';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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
});
