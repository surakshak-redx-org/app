import { render } from '@testing-library/react-native';
import React from 'react';

import NewsDetailScreen from '@app/news/[id]';

describe('NewsDetailScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<NewsDetailScreen />);
    expect(getByText('News')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<NewsDetailScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
