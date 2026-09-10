import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/stores/auth.store';
import SafeJourneyScreen from '@app/safe-journey';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockGetActiveJourney = jest.fn(() => Promise.resolve(null));
jest.mock('@/services/firebase/safe-journey.service', () => ({
  getActiveJourneySession: () => mockGetActiveJourney(),
  createSafeJourneySession: jest.fn(),
  checkInSafeJourney: jest.fn(() => Promise.resolve()),
  extendSafeJourneyEta: jest.fn(() => Promise.resolve()),
  markSafeJourneyArrived: jest.fn(() => Promise.resolve()),
  markAlertSent: jest.fn(() => Promise.resolve()),
  cancelSafeJourney: jest.fn(() => Promise.resolve()),
}));

const authSnapshot = useAuthStore.getState();

describe('SafeJourneyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveJourney.mockResolvedValue(null);
    useAuthStore.setState({ ...authSnapshot });
  });

  it('renders the destination field and the start button', async () => {
    const { getByText } = await render(<SafeJourneyScreen />);
    expect(getByText('Destination')).toBeTruthy();
    expect(getByText('Start Journey')).toBeTruthy();
  });

  it('accepts a destination and an ETA preset', async () => {
    const { getByText, getByPlaceholderText } = await render(<SafeJourneyScreen />);
    await fireEvent.changeText(getByPlaceholderText('Where are you going?'), 'Andheri Station');
    await fireEvent.press(getByText('15 min'));
    expect(getByText('Start Journey')).toBeTruthy();
  });

  it('shows the active-journey controls when a session is in progress', async () => {
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
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: [],
      startedAt: { toDate: () => new Date() },
      expectedArrivalAt: { toDate: () => new Date(Date.now() + 600_000) },
      status: 'active',
    } as never);

    const { findByText } = await render(<SafeJourneyScreen />);
    expect(await findByText('Andheri Station')).toBeTruthy();
    expect(await findByText("I'm Safe ✓")).toBeTruthy();
    expect(await findByText('Cancel Journey')).toBeTruthy();
  });
});
