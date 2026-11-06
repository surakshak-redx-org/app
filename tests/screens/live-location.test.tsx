import { fireEvent, render } from '@testing-library/react-native';
import * as Location from 'expo-location';
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

  it('offers an optional destination that ends sharing on arrival', async () => {
    const { getByText, getByPlaceholderText } = await render(<LiveLocationScreen />);
    expect(getByPlaceholderText('Where are you going?')).toBeTruthy();
    expect(getByText('Optional. Sharing stops automatically when you arrive.')).toBeTruthy();
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

  describe('foreground-only warning', () => {
    function givenRunningSession(overrides: Record<string, unknown> = {}): void {
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
        ...overrides,
      } as never);
    }

    it('shows where the sender is heading when the session has a destination', async () => {
      givenRunningSession({ destination: { name: 'Office', latitude: 19.2, longitude: 72.9 } });
      jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

      const { findByText } = await render(<LiveLocationScreen />);
      expect(await findByText('Heading to Office')).toBeTruthy();
    });

    it('warns when the session has no background task running', async () => {
      givenRunningSession();
      jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(false);

      const { findByText } = await render(<LiveLocationScreen />);
      expect(await findByText('Keep Surakshak open')).toBeTruthy();
    });

    it('does not warn when the background task is running', async () => {
      givenRunningSession();
      jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

      const { findByText, queryByText } = await render(<LiveLocationScreen />);
      expect(await findByText('Stop Sharing')).toBeTruthy();
      expect(queryByText('Keep Surakshak open')).toBeNull();
    });
  });
});
