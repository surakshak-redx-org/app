import { render } from '@testing-library/react-native';
import React from 'react';

import SettingsScreen from '@app/settings';

describe('SettingsScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
