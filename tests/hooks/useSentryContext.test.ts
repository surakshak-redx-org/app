import { act, renderHook } from '@testing-library/react-native';

import { setSentryTags, setSentryUser } from '@/config/sentry';
import { useSentryContext } from '@/hooks/useSentryContext';
import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/user.types';

jest.mock('@/config/sentry', () => ({
  setSentryUser: jest.fn(),
  setSentryTags: jest.fn(),
}));

const firebaseUser = { uid: 'uid-1', phoneNumber: '+919876543210' } as never;

describe('useSentryContext', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    jest.clearAllMocks();
  });

  it('clears the user and tags a signed-out, non-guest session', async () => {
    await renderHook(() => useSentryContext());

    expect(setSentryUser).toHaveBeenCalledWith(null);
    expect(setSentryTags).toHaveBeenCalledWith({ is_guest: 'false' });
  });

  it('sets only the uid (never the phone number) once signed in', async () => {
    await renderHook(() => useSentryContext());
    await act(() => {
      useAuthStore.getState().setUser(firebaseUser);
    });

    expect(setSentryUser).toHaveBeenLastCalledWith('uid-1');
    expect(JSON.stringify(jest.mocked(setSentryUser).mock.calls)).not.toContain('9876543210');
  });

  it('tags the language once the profile loads', async () => {
    await renderHook(() => useSentryContext());
    await act(() => {
      useAuthStore.getState().setSurakshakUser({ language: 'hi' } as User);
    });

    expect(setSentryTags).toHaveBeenLastCalledWith({ is_guest: 'false', language: 'hi' });
  });

  it('tags guests', async () => {
    await renderHook(() => useSentryContext());
    await act(() => {
      useAuthStore.getState().setGuest(true);
    });

    expect(setSentryTags).toHaveBeenLastCalledWith({ is_guest: 'true' });
  });

  it('clears the user again on sign-out', async () => {
    await renderHook(() => useSentryContext());
    await act(() => {
      useAuthStore.getState().setUser(firebaseUser);
    });
    await act(() => {
      useAuthStore.getState().reset();
    });

    expect(setSentryUser).toHaveBeenLastCalledWith(null);
  });
});
