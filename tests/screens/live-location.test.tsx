import { render } from '@testing-library/react-native';
import React from 'react';

import LiveLocationScreen from '@app/live-location';

describe('LiveLocationScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<LiveLocationScreen />);
    expect(getByText('Live Location')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<LiveLocationScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
