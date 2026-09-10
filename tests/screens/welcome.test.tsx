import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import WelcomeScreen from '@app/(auth)/welcome';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('offers both the phone and guest entry points', async () => {
    const { getByText } = await render(<WelcomeScreen />);

    expect(getByText('Continue with Phone')).toBeTruthy();
    expect(getByText('Continue as Guest')).toBeTruthy();
  });

  it('navigates to the phone screen', async () => {
    const { getByText } = await render(<WelcomeScreen />);

    await fireEvent.press(getByText('Continue with Phone'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/phone');
  });

  it('enters guest mode and goes home', async () => {
    const { getByText } = await render(<WelcomeScreen />);

    await fireEvent.press(getByText('Continue as Guest'));

    expect(useAuthStore.getState().isGuest).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });
});
