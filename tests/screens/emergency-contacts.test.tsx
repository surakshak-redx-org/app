import { render } from '@testing-library/react-native';
import React from 'react';

import EmergencyContactsScreen from '@app/emergency-contacts';

describe('EmergencyContactsScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<EmergencyContactsScreen />);
    expect(getByText('Emergency Contacts')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<EmergencyContactsScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
