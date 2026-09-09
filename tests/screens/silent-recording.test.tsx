import { render } from '@testing-library/react-native';
import React from 'react';

import SilentRecordingScreen from '@app/silent-recording';

describe('SilentRecordingScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<SilentRecordingScreen />);
    expect(getByText('Silent Recording')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<SilentRecordingScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
