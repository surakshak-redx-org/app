import { render } from '@testing-library/react-native';
import React from 'react';

import MapScreen from '@app/(tabs)/map';

describe('MapScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<MapScreen />);
    expect(getByText('Safety Map')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<MapScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
