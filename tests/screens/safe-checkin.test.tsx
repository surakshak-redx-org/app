import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { scheduleLocalNotification } from '@/services/notification.service';
import { useUserStore } from '@/stores/user.store';
import SafeCheckinScreen from '@app/safe-checkin';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/notification.service', () => ({
  scheduleLocalNotification: jest.fn(() => Promise.resolve('notification-1')),
  cancelLocalNotification: jest.fn(() => Promise.resolve()),
}));

const CONTACT = {
  id: 'c1',
  name: 'Ma',
  phone: '9876543210',
  relationship: 'Mother',
  isPredefined: false,
  order: 0,
};

describe('SafeCheckinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserStore.getState().reset();
  });

  it('renders without crashing', async () => {
    const { getByText } = await render(<SafeCheckinScreen />);
    expect(getByText('Safe Check-in')).toBeTruthy();
  });

  it('shows the interval chips and the contact selector prompt', async () => {
    const { getByText } = await render(<SafeCheckinScreen />);
    expect(getByText('15m')).toBeTruthy();
    expect(getByText('120m')).toBeTruthy();
    expect(getByText('Start Check-In')).toBeTruthy();
  });

  it('disables Start until a contact is selected, then starts once one is', async () => {
    useUserStore.getState().setEmergencyContacts([CONTACT]);
    const { getByText } = await render(<SafeCheckinScreen />);

    await act(async () => {
      await fireEvent.press(getByText('30m'));
    });
    await act(async () => {
      await fireEvent.press(getByText('Ma'));
    });
    await act(async () => {
      await fireEvent.press(getByText('Start Check-In'));
    });

    expect(scheduleLocalNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      30 * 60,
      { type: 'safe_checkin' },
    );
    expect(getByText('Check-In Active')).toBeTruthy();
  });
});
