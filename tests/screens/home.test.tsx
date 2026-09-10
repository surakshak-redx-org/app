import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import HomeScreen from '@app/(tabs)/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    loop: false,
    volume: 0,
  }),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(1)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  sendSMSAsync: jest.fn(),
}));

describe('HomeScreen', () => {
  it('renders the SOS button and the quick actions', async () => {
    const { getByText, getByLabelText } = await render(<HomeScreen />);

    expect(getByLabelText('SOS Emergency Button')).toBeTruthy();
    expect(getByText('Live Location')).toBeTruthy();
    expect(getByText('Siren')).toBeTruthy();
    expect(getByText('Fake Call')).toBeTruthy();
  });

  it('shows the countdown after three quick taps on the SOS button', async () => {
    const { getByLabelText, getByText } = await render(<HomeScreen />);
    const button = getByLabelText('SOS Emergency Button');

    await fireEvent.press(button);
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(getByText('Sending SOS in 5s...')).toBeTruthy();
  });
});
