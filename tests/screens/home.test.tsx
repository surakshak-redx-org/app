import { render } from '@testing-library/react-native';
import React from 'react';

import HomeScreen from '@app/(tabs)/index';

describe('HomeScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<HomeScreen />);
    expect(getByText('Surakshak')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<HomeScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
