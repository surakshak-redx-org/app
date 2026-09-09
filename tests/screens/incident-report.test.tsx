import { render } from '@testing-library/react-native';
import React from 'react';

import IncidentReportScreen from '@app/incident-report';

describe('IncidentReportScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<IncidentReportScreen />);
    expect(getByText('Report an Incident')).toBeTruthy();
  });

  it('shows the coming-soon placeholder', async () => {
    const { getByText } = await render(<IncidentReportScreen />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
