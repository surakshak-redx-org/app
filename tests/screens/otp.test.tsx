import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { OTP_LENGTH } from '@/constants/auth';
import { AuthError, verifyOtp } from '@/services/firebase/auth.service';
import { doesUserExist } from '@/services/firebase/user.service';
import OtpScreen from '@app/(auth)/otp';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ phone: '+919876543210' }),
}));

jest.mock('@app/(auth)/phone', () => ({
  getStoredConfirmation: () => ({ confirm: jest.fn() }),
  setStoredConfirmation: jest.fn(),
}));

jest.mock('@/services/firebase/auth.service', () => {
  class MockAuthError extends Error {
    i18nKey: string;
    constructor(key: string) {
      super(key);
      this.i18nKey = key;
    }
  }
  return { AuthError: MockAuthError, verifyOtp: jest.fn(), sendOtp: jest.fn() };
});

jest.mock('@/services/firebase/user.service', () => ({
  doesUserExist: jest.fn(),
}));

describe('OtpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one input box per OTP digit and the masked destination', async () => {
    const { getAllByLabelText, getByText } = await render(<OtpScreen />);

    expect(getAllByLabelText('Enter OTP')).toHaveLength(OTP_LENGTH);
    expect(getByText('OTP sent to +91XXXXXX3210')).toBeTruthy();
  });

  it('auto-submits when all digits are entered and routes a new user to onboarding', async () => {
    jest.mocked(verifyOtp).mockResolvedValue({ user: { uid: 'u1' } } as never);
    jest.mocked(doesUserExist).mockResolvedValue(false);

    const { getAllByLabelText } = await render(<OtpScreen />);

    await [0, 1, 2, 3, 4, 5].reduce(
      (chain, i) =>
        chain.then(() =>
          fireEvent.changeText(getAllByLabelText('Enter OTP')[i] as never, String(i)),
        ),
      Promise.resolve(),
    );

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith(expect.anything(), '012345');
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
  });

  it('shows an error and clears the boxes on a bad code', async () => {
    jest.mocked(verifyOtp).mockRejectedValue(new AuthError('auth.otpInvalid'));

    const { getAllByLabelText, findByText } = await render(<OtpScreen />);

    await [0, 1, 2, 3, 4, 5].reduce(
      (chain, i) =>
        chain.then(() => fireEvent.changeText(getAllByLabelText('Enter OTP')[i] as never, '1')),
      Promise.resolve(),
    );

    expect(await findByText('Enter the 6-digit OTP')).toBeTruthy();
  });
});
