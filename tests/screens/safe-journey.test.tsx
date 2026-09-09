import { render } from '@testing-library/react-native';
import React from 'react';

import SafeJourneyScreen from '@app/safe-journey';

describe('SafeJourneyScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<SafeJourneyScreen />);
    expect(getByText('Safe Journey')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<SafeJourneyScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
