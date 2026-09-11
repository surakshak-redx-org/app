import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import OnboardingScreen from '@app/(auth)/onboarding';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts on the language step with all three options', async () => {
    const { getByText, getAllByText } = await render(<OnboardingScreen />);

    expect(getByText('Choose Your Language')).toBeTruthy();
    // 'English' appears twice for the English option — once as the native
    // name, once as the English name shown alongside every option.
    expect(getAllByText('English')).toHaveLength(2);
    expect(getByText('हिन्दी')).toBeTruthy();
    expect(getByText('Hindi')).toBeTruthy();
    expect(getByText('मराठी')).toBeTruthy();
    expect(getByText('Marathi')).toBeTruthy();
  });

  it('advances to the permissions step', async () => {
    const { getByText } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Allow Permissions')).toBeTruthy();
    });
  });

  it('blocks leaving the permissions step until the required ones are granted', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { getByText } = await render(<OnboardingScreen />);
    await fireEvent.press(getByText('Next'));
    await waitFor(() => getByText('Allow Permissions'));
    await fireEvent.press(getByText('Next'));

    expect(alertSpy).toHaveBeenCalledWith(
      'This permission is required for Surakshak to protect you',
    );

    alertSpy.mockRestore();
  });
});
