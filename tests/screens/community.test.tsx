import { render } from '@testing-library/react-native';
import React from 'react';

import CommunityScreen from '@app/(tabs)/community';

describe('CommunityScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<CommunityScreen />);
    expect(getByText('Community')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<CommunityScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
