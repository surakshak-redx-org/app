import { getDoc } from '@react-native-firebase/firestore';
import { act, render } from '@testing-library/react-native';
import React from 'react';

import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/stores/auth.store';
import RootLayout from '@app/_layout';

jest.mock('@/global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  const actualReact = jest.requireActual('react');
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      actualReact.createElement(actualReact.Fragment, null, children),
  };
});

const mockReplace = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('expo-router', () => ({
  Slot: (): null => null,
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
}));

jest.mock('@/services/firebase/auth.service', () => ({
  subscribeToAuthChanges: (cb: (u: unknown) => void): (() => void) => {
    mockSubscribe(cb);
    return jest.fn();
  },
}));

function emitAuth(user: unknown): Promise<void> {
  const callback = mockSubscribe.mock.calls[0][0] as (u: unknown) => void;
  return act(async () => {
    callback(user);
    await Promise.resolve();
  });
}

describe('RootLayout auth listener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('subscribes to auth changes on mount', async () => {
    await render(<RootLayout />);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('routes a brand-new signed-in user to onboarding', async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce({ exists: () => false, id: 'u1', data: () => undefined } as never);

    await render(<RootLayout />);
    await emitAuth({ uid: 'u1', phoneNumber: '+910000000000' });

    expect(mockReplace).toHaveBeenCalledWith(ROUTES.ONBOARDING);
  });

  it('loads the profile for a returning user without redirecting to onboarding', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'u1',
      data: () => ({
        name: 'Priya',
        phone: '+919876543210',
        profilePhotoUrl: '',
        city: 'Mumbai',
        state: '',
        language: 'en',
        isGuest: false,
        createdAt: {},
        updatedAt: {},
      }),
    } as never);

    await render(<RootLayout />);
    await emitAuth({ uid: 'u1', phoneNumber: '+919876543210' });

    expect(useAuthStore.getState().surakshakUser?.name).toBe('Priya');
    expect(mockReplace).not.toHaveBeenCalledWith(ROUTES.ONBOARDING);
  });

  it('clears the user on sign-out when not in guest mode', async () => {
    await render(<RootLayout />);
    useAuthStore.getState().setUser({ uid: 'u1' } as never);

    await emitAuth(null);

    expect(useAuthStore.getState().user).toBeNull();
  });
});
