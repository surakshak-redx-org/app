import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { SMSAlertRecord } from '@/types/emergency.types';
import SmsAlertHistoryScreen from '@app/sms-alert-history';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockGetSMSAlertHistory = jest.fn<Promise<SMSAlertRecord[]>, []>();

jest.mock('@/services/sms.service', () => ({
  getSMSAlertHistory: () => mockGetSMSAlertHistory(),
  clearSMSAlertHistory: jest.fn(() => Promise.resolve()),
}));

describe('SmsAlertHistoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state when there is no history', async () => {
    mockGetSMSAlertHistory.mockResolvedValue([]);
    const { getByText } = await render(<SmsAlertHistoryScreen />);

    await waitFor(() => {
      expect(getByText('No alerts sent yet')).toBeTruthy();
    });
  });

  it('renders a record with its type badge and delivery summary', async () => {
    mockGetSMSAlertHistory.mockResolvedValue([
      {
        id: 'r1',
        timestamp: Date.now(),
        type: 'sos',
        locationUrl: 'https://maps/here',
        contactsSent: ['+91a', '+91b'],
        contactsFailed: ['+91c'],
      },
    ]);

    const { getByText } = await render(<SmsAlertHistoryScreen />);

    await waitFor(() => {
      expect(getByText('SOS')).toBeTruthy();
    });
    expect(getByText('Sent to 2 · Failed 1')).toBeTruthy();
    expect(getByText('View location')).toBeTruthy();
  });
});
