import { render } from '@testing-library/react-native';
import React from 'react';

import ProfileScreen from '@app/(tabs)/profile';

describe('ProfileScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<ProfileScreen />);
    expect(getByText('Profile')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<ProfileScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
