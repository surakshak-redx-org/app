import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/user.types';
import ProfileScreen from '@app/(tabs)/profile';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const FAKE_USER = {
  userId: 'u1',
  name: 'Priya',
  phone: '+919876543210',
  profilePhotoUrl: '',
  city: 'Mumbai',
  state: 'MH',
  language: 'en',
  isGuest: false,
  createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z') },
  updatedAt: { toDate: () => new Date('2024-01-01T00:00:00Z') },
} as unknown as User;

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('shows the GuestBanner when the user is a guest', async () => {
    useAuthStore.getState().setGuest(true);

    const { getByText } = await render(<ProfileScreen />);

    expect(getByText('Sign in to access all features')).toBeTruthy();
    expect(getByText('Sign In Now')).toBeTruthy();
  });

  it('shows the profile card and masked phone for an authenticated user', async () => {
    useAuthStore.getState().setUser({ uid: 'u1' } as never);
    useAuthStore.getState().setSurakshakUser(FAKE_USER);

    const { getByText } = await render(<ProfileScreen />);

    expect(getByText('Priya')).toBeTruthy();
    expect(getByText('+91XXXXXX3210')).toBeTruthy();
  });

  it('confirms before signing out', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.getState().setUser({ uid: 'u1' } as never);
    useAuthStore.getState().setSurakshakUser(FAKE_USER);

    const { getByText } = await render(<ProfileScreen />);
    await fireEvent.press(getByText('Sign Out'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out?',
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });
});
