import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import SettingsScreen from '@app/settings';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((_algorithm: string, data: string) => Promise.resolve(`hash:${data}`)),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

async function enterPin(getByTestId: (testId: string) => unknown, pin: string): Promise<void> {
  const digits = pin.split('');
  for (let index = 0; index < digits.length; index += 1) {
    await fireEvent.changeText(getByTestId(`pin-box-${index}`) as never, digits[index] as string);
  }
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the safety toggles and the danger zone', async () => {
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Shake to SOS')).toBeTruthy();
    expect(getByText('SMS Alert History')).toBeTruthy();
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

  it('renders the Phase 7 rows: follow detection, safe check-in, silent recording, disguise mode', async () => {
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('Suspicious Follow Alert')).toBeTruthy();
    expect(getByText('Safe Check-In')).toBeTruthy();
    expect(getByText('Off')).toBeTruthy();
    expect(getByText('Silent Recording')).toBeTruthy();
    expect(getByText('Disguise Mode')).toBeTruthy();
  });

  it('persists the follow-detection toggle', async () => {
    const { getAllByRole } = await render(<SettingsScreen />);

    const switches = getAllByRole('switch');
    const followSwitch = switches[2];
    await fireEvent(followSwitch as never, 'valueChange', false);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'surakshak_follow_detection_enabled',
      'false',
    );
  });

  it('enables Disguise Mode once the PIN is entered twice matching', async () => {
    const { getAllByRole, getByTestId, getByText } = await render(<SettingsScreen />);

    const switches = getAllByRole('switch');
    const disguiseSwitch = switches[switches.length - 1];
    await fireEvent(disguiseSwitch as never, 'valueChange', true);

    expect(getByText('Enter a PIN')).toBeTruthy();
    await enterPin(getByTestId, '1234');
    expect(getByText('Confirm your PIN')).toBeTruthy();
    await enterPin(getByTestId, '1234');

    expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
      ['surakshak_disguise_enabled', 'true'],
      ['surakshak_disguise_pin_hash', 'hash:1234'],
    ]);
  });

  it('shows a mismatch error and restarts when the confirm PIN differs', async () => {
    const { getAllByRole, getByTestId, getByText } = await render(<SettingsScreen />);

    const switches = getAllByRole('switch');
    const disguiseSwitch = switches[switches.length - 1];
    await fireEvent(disguiseSwitch as never, 'valueChange', true);

    await enterPin(getByTestId, '1234');
    await enterPin(getByTestId, '9999');

    expect(getByText("PINs didn't match. Try again.")).toBeTruthy();
  });
});
