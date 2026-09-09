import { render } from '@testing-library/react-native';
import React from 'react';

import WelcomeScreen from '@app/(auth)/welcome';

describe('WelcomeScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<WelcomeScreen />);
    expect(getByText('Welcome to Surakshak')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<WelcomeScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
