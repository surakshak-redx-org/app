import { render } from '@testing-library/react-native';
import React from 'react';

import LawDetailScreen from '@app/law/[id]';

describe('LawDetailScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<LawDetailScreen />);
    expect(getByText('Law Details')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<LawDetailScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
