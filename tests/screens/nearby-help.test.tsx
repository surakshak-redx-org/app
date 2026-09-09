import { render } from '@testing-library/react-native';
import React from 'react';

import NearbyHelpScreen from '@app/nearby-help';

describe('NearbyHelpScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<NearbyHelpScreen />);
    expect(getByText('Nearby Help')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<NearbyHelpScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
