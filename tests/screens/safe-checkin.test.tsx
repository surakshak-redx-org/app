import { render } from '@testing-library/react-native';
import React from 'react';

import SafeCheckinScreen from '@app/safe-checkin';

describe('SafeCheckinScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<SafeCheckinScreen />);
    expect(getByText('Safe Check-in')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<SafeCheckinScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
