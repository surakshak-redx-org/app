import { render } from '@testing-library/react-native';
import React from 'react';

import InfoScreen from '@app/(tabs)/info';

describe('InfoScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<InfoScreen />);
    expect(getByText('Information')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<InfoScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
