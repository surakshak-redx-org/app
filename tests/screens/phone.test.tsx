import { render } from '@testing-library/react-native';
import React from 'react';

import PhoneScreen from '@app/(auth)/phone';

describe('PhoneScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<PhoneScreen />);
    expect(getByText('Enter your phone number')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<PhoneScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
