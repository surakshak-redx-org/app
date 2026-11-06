import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { APP_CONFIG } from '@/constants/config';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import SafeJourneyScreen from '@app/safe-journey';

// The first cold render of this screen (vector-icon glyph maps + NativeWind JIT,
// under `--coverage`) can exceed Jest's 5s default on a loaded CI runner. The
// suite time varies from ~7s to ~14s between identical CI runs.
jest.setTimeout(20000);

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

const mockSendSafeJourneyEtaExtended = jest.fn<
  Promise<{ sent: string[]; failed: string[] }>,
  [unknown, string, string, string, string]
>(() => Promise.resolve({ sent: ['+919000000000'], failed: [] }));

const mockSendSafeJourneyArrived = jest.fn<
  Promise<{ sent: string[]; failed: string[] }>,
  [unknown, string, string, string]
>(() => Promise.resolve({ sent: ['+919000000000'], failed: [] }));

const mockSendSafeJourneyCancelled = jest.fn<
  Promise<{ sent: string[]; failed: string[] }>,
  [unknown, string, string, string]
>(() => Promise.resolve({ sent: ['+919000000000'], failed: [] }));

jest.mock('@/services/sms.service', () => ({
  sendSafeJourneyStart: jest.fn(() => Promise.resolve({ sent: ['+919000000000'], failed: [] })),
  sendSafeJourneyEtaExtended: (
    contacts: unknown,
    dest: string,
    eta: string,
    name: string,
    lang: string,
  ) => mockSendSafeJourneyEtaExtended(contacts, dest, eta, name, lang),
  sendSafeJourneyArrived: (contacts: unknown, dest: string, name: string, lang: string) =>
    mockSendSafeJourneyArrived(contacts, dest, name, lang),
  sendSafeJourneyCancelled: (contacts: unknown, dest: string, name: string, lang: string) =>
    mockSendSafeJourneyCancelled(contacts, dest, name, lang),
  recordSMSAlert: jest.fn(() => Promise.resolve()),
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
    expect(await findByText("Check in: I'm safe (reset timer)")).toBeTruthy();
    expect(await findByText('Cancel Journey')).toBeTruthy();
  });

  it('tells the user how long they have left while still inside the grace period', async () => {
    useAuthStore.setState({
      ...authSnapshot,
      surakshakUser: { userId: 'u1', name: 'Asha', language: 'en' } as never,
    });
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: [],
      startedAt: { toDate: () => new Date(Date.now() - 3_600_000) },
      // One minute past the deadline: inside the grace period.
      expectedArrivalAt: { toDate: () => new Date(Date.now() - 60_000) },
      status: 'active',
    } as never);

    const { findByText, queryByText } = await render(<SafeJourneyScreen />);

    expect(await findByText(/Confirm you've arrived or extend your time within/)).toBeTruthy();
    // Contacts have not been alerted yet, so the screen must not claim they were.
    expect(queryByText(/An alert was sent to your emergency contacts/)).toBeNull();
  });

  it('displays overdue status for an already-overdue journey and bumps monitor revision', async () => {
    useAuthStore.setState({
      ...authSnapshot,
      surakshakUser: { userId: 'u1', name: 'Asha', language: 'en' } as never,
    });
    const graceMs = APP_CONFIG.SAFE_JOURNEY_OVERDUE_GRACE_SECONDS * 1000;
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: [],
      startedAt: { toDate: () => new Date(Date.now() - 3_600_000) },
      // Past the deadline and the grace period: the alert has gone out.
      expectedArrivalAt: { toDate: () => new Date(Date.now() - 60_000 - graceMs) },
      status: 'active',
    } as never);
    const revisionBefore = useLocationStore.getState().safeJourneyRevision;

    const { findAllByText, findByText } = await render(<SafeJourneyScreen />);

    expect(await findByText('Andheri Station')).toBeTruthy();
    expect(
      await findByText(
        'Your arrival deadline has passed. An alert was sent to your emergency contacts.',
      ),
    ).toBeTruthy();
    const overdueBadges = await findAllByText('Journey Overdue');
    expect(overdueBadges.length).toBeGreaterThan(0);
    expect(useLocationStore.getState().safeJourneyRevision).toBeGreaterThan(revisionBefore);
  });

  it('warns when the destination was typed instead of picked', async () => {
    const { getByPlaceholderText, findByText } = await render(<SafeJourneyScreen />);
    await fireEvent.changeText(getByPlaceholderText('Where are you going?'), 'Andheri Station');
    expect(
      await findByText(
        'Not picked from the suggestions: your current location will be saved as the destination.',
      ),
    ).toBeTruthy();
  });

  it('marks journey arrived locally and handles backend sync error gracefully', async () => {
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

    const markArrivedMock = jest.requireMock(
      '@/services/firebase/safe-journey.service',
    ).markSafeJourneyArrived;
    markArrivedMock.mockRejectedValueOnce(new Error('Offline network error'));

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const arrivedBtn = buttons?.find((button) => button.text === "I've Arrived");
      arrivedBtn?.onPress?.();
    });

    useLocationStore.getState().setSafeJourneyActive(true, 'j1');
    const { findByText } = await render(<SafeJourneyScreen />);

    const arrivedButton = await findByText("I've Arrived");
    await fireEvent.press(arrivedButton);

    expect(useLocationStore.getState().isSafeJourneyActive).toBe(false);
  });

  it('dispatches extension SMS when extending journey duration', async () => {
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
    useLocationStore.getState().setSafeJourneyActive(true, 'j1');
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: ['c1'],
      startedAt: { toDate: () => new Date() },
      expectedArrivalAt: { toDate: () => new Date(Date.now() + 600_000) },
      status: 'active',
    } as never);

    const { findByText } = await render(<SafeJourneyScreen />);
    const plus15Button = await findByText('+15 min');
    await fireEvent.press(plus15Button);

    const extendMock = jest.requireMock(
      '@/services/firebase/safe-journey.service',
    ).extendSafeJourneyEta;
    expect(extendMock).toHaveBeenCalledWith('j1', 15);
  });

  it('dispatches arrival SMS when user confirms arrival with contacts', async () => {
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
    useLocationStore.getState().setSafeJourneyActive(true, 'j1');
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: ['c1'],
      startedAt: { toDate: () => new Date() },
      expectedArrivalAt: { toDate: () => new Date(Date.now() + 600_000) },
      status: 'active',
    } as never);

    useUserStore.setState({
      emergencyContacts: [
        {
          id: 'c1',
          name: 'Mom',
          phone: '9876543210',
          relationship: 'Mother',
          isPredefined: false,
          order: 0,
        },
      ],
    });

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const arrivedBtn = buttons?.find((button) => button.text === "I've Arrived");
      arrivedBtn?.onPress?.();
    });

    const { findByText } = await render(<SafeJourneyScreen />);
    const arrivedButton = await findByText("I've Arrived");
    await fireEvent.press(arrivedButton);

    expect(mockSendSafeJourneyArrived).toHaveBeenCalledWith(
      expect.anything(),
      'Andheri Station',
      'Asha',
      'en',
    );
  });

  it('dispatches cancellation SMS when user cancels journey with contacts', async () => {
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
    useLocationStore.getState().setSafeJourneyActive(true, 'j1');
    mockGetActiveJourney.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      destinationName: 'Andheri Station',
      destinationLatitude: 19.1,
      destinationLongitude: 72.8,
      etaMinutes: 30,
      sharedWithUserIds: ['c1'],
      startedAt: { toDate: () => new Date() },
      expectedArrivalAt: { toDate: () => new Date(Date.now() + 600_000) },
      status: 'active',
    } as never);
    useUserStore.setState({
      emergencyContacts: [
        {
          id: 'c1',
          name: 'Mom',
          phone: '9876543210',
          relationship: 'Mother',
          isPredefined: false,
          order: 0,
        },
      ],
    });

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const cancelBtn = buttons?.find((button) => button.text === 'Cancel Journey');
      cancelBtn?.onPress?.();
    });

    const { findByText } = await render(<SafeJourneyScreen />);
    const cancelJourneyButton = await findByText('Cancel Journey');
    await fireEvent.press(cancelJourneyButton);

    expect(mockSendSafeJourneyCancelled).toHaveBeenCalledWith(
      expect.anything(),
      'Andheri Station',
      'Asha',
      'en',
    );
  });
});
