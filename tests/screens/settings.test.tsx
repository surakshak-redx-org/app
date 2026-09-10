import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import SettingsScreen from '@app/settings';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the safety toggles and the danger zone', async () => {
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Shake to SOS')).toBeTruthy();
    expect(getByText('Low Battery Alert')).toBeTruthy();
    expect(getByText('Delete Account')).toBeTruthy();
  });

  it('persists a toggle change to AsyncStorage', async () => {
    const { getAllByRole } = await render(<SettingsScreen />);

    const [shakeSwitch] = getAllByRole('switch');
    await fireEvent(shakeSwitch as never, 'valueChange', false);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('surakshak_shake_enabled', 'false');
  });

  it('asks for confirmation before deleting the account', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('Delete Account'));

    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
