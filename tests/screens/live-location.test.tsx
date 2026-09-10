import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import LiveLocationScreen from '@app/live-location';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockGetActiveLiveSession = jest.fn(() => Promise.resolve(null));
jest.mock('@/services/firebase/live-location.service', () => ({
  getActiveLiveSession: () => mockGetActiveLiveSession(),
  createLiveLocationSession: jest.fn(),
  stopLiveLocationSession: jest.fn(() => Promise.resolve()),
  extendLiveLocationSession: jest.fn(() => Promise.resolve()),
  updateLiveLocation: jest.fn(),
}));

const authSnapshot = useAuthStore.getState();

describe('LiveLocationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveLiveSession.mockResolvedValue(null);
    useUserStore.getState().reset();
    useAuthStore.setState({ ...authSnapshot });
  });

  it('renders the duration options and the start button', async () => {
    const { getByText } = await render(<LiveLocationScreen />);
    expect(getByText('Start Sharing')).toBeTruthy();
    expect(getByText('1h')).toBeTruthy();
    expect(getByText('8h')).toBeTruthy();
  });

  it('selects a contact and a duration', async () => {
    useUserStore.getState().setEmergencyContacts([
      {
        id: 'c1',
        name: 'Asha',
        phone: '9000000001',
        relationship: 'Sister',
        isPredefined: false,
        order: 0,
      },
    ]);

    const { getByText } = await render(<LiveLocationScreen />);
    await fireEvent.press(getByText('Asha'));
    await fireEvent.press(getByText('4h'));
    expect(getByText('Start Sharing')).toBeTruthy();
  });

  it('shows the active-session card when a session is already running', async () => {
    useAuthStore.setState({
      ...authSnapshot,
      surakshakUser: {
        userId: 'u1',
        name: 'Asha',
        phone: '9000000000',
        profilePhotoUrl: '',
        city: 'Mumbai',
        state: 'MH',
        language: 'en',
        isGuest: false,
        createdAt: null as never,
        updatedAt: null as never,
      },
    });
    mockGetActiveLiveSession.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      latitude: 19,
      longitude: 72,
      locationUrl: 'https://www.google.com/maps/place/19,72',
      sharedWithUserIds: [],
      startedAt: { toDate: () => new Date() },
      expiresAt: { toDate: () => new Date(Date.now() + 3_600_000) },
      isActive: true,
    } as never);

    const { findByText } = await render(<LiveLocationScreen />);
    expect(await findByText('Stop Sharing')).toBeTruthy();
    expect(await findByText('Extend 1 Hour')).toBeTruthy();
  });
});
