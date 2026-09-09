import { render } from '@testing-library/react-native';
import React from 'react';

import OtpScreen from '@app/(auth)/otp';

describe('OtpScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<OtpScreen />);
    expect(getByText('Enter OTP')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<OtpScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
