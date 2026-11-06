import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import React from 'react';
import { Alert, Share } from 'react-native';

import { ENV } from '@/config/env';
import { revokeShareToken } from '@/services/firebase/live-location.service';
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
  revokeShareToken: jest.fn(() => Promise.resolve()),
  updateLiveLocation: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
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

  describe('running session', () => {
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

    describe('tracking link', () => {
      const BASE_URL = 'https://track.example.com/track';
      const LINK = `${BASE_URL}/feedface`;

      beforeEach(() => {
        Object.assign(ENV, { TRACKING_BASE_URL: BASE_URL });
        givenRunningSession({ shareToken: 'feedface' });
        jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      });

      afterEach(() => {
        Object.assign(ENV, { TRACKING_BASE_URL: undefined });
        jest.restoreAllMocks();
      });

      it('shows the link with copy, share and stop actions', async () => {
        const { findByText, getByText } = await render(<LiveLocationScreen />);

        expect(await findByText(LINK)).toBeTruthy();
        expect(getByText('Copy link')).toBeTruthy();
        expect(getByText('Share link')).toBeTruthy();
        expect(getByText('Stop link')).toBeTruthy();
      });

      it('copies the link to the clipboard', async () => {
        const { findByText } = await render(<LiveLocationScreen />);

        await fireEvent.press(await findByText('Copy link'));

        await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(LINK));
        expect(Alert.alert).toHaveBeenCalledWith('Link copied');
      });

      it('opens the share sheet with the link', async () => {
        const shareSpy = jest
          .spyOn(Share, 'share')
          .mockResolvedValue({ action: Share.sharedAction });
        const { findByText } = await render(<LiveLocationScreen />);

        await fireEvent.press(await findByText('Share link'));

        expect(shareSpy).toHaveBeenCalledWith({
          message: `Follow my live location on Surakshak: ${LINK}`,
        });
      });

      it('stops the link only after the sender confirms', async () => {
        const { findByText } = await render(<LiveLocationScreen />);

        await fireEvent.press(await findByText('Stop link'));
        expect(revokeShareToken).not.toHaveBeenCalled();

        const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
        const confirm = buttons?.find((button) => button.text === 'Stop link');
        await act(() => {
          confirm?.onPress?.();
        });

        await waitFor(() => expect(revokeShareToken).toHaveBeenCalledWith('s1'));
        expect(
          await findByText(
            'The tracking link is stopped. Contacts can no longer see your location.',
          ),
        ).toBeTruthy();
      });

      it('does not stop the link when the sender cancels', async () => {
        const { findByText, queryByText } = await render(<LiveLocationScreen />);

        await fireEvent.press(await findByText('Stop link'));
        const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
        const cancel = buttons?.find((button) => button.style === 'cancel');
        await act(() => {
          cancel?.onPress?.();
        });

        expect(revokeShareToken).not.toHaveBeenCalled();
        expect(queryByText('Copy link')).toBeTruthy();
      });

      it('shows no link controls when this build has no tracking page', async () => {
        Object.assign(ENV, { TRACKING_BASE_URL: undefined });
        const { findByText, queryByText } = await render(<LiveLocationScreen />);

        expect(await findByText('Stop Sharing')).toBeTruthy();
        expect(queryByText('Copy link')).toBeNull();
        expect(queryByText('Tracking link')).toBeNull();
      });
    });

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
