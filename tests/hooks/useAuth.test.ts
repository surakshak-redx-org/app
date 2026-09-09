import { act, renderHook } from '@testing-library/react-native';

import { useAuth } from '@/hooks/useAuth';
import { signOutUser } from '@/services/firebase/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';

jest.mock('@/services/firebase/auth.service', () => ({
  signOutUser: jest.fn(() => Promise.resolve()),
}));

// RNTL 14 made `renderHook` and `act` async — both must be awaited.
describe('useAuth', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useUserStore.getState().reset();
    jest.mocked(signOutUser).mockClear();
    jest.mocked(signOutUser).mockResolvedValue(undefined);
  });

  it('starts uninitialised and signed out', async () => {
    const { result } = await renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isInitialized).toBe(false);
  });

  it('reflects guest mode from the store', async () => {
    const { result } = await renderHook(() => useAuth());

    await act(() => {
      useAuthStore.getState().setGuest(true);
    });

    expect(result.current.isGuest).toBe(true);
  });

  it('clears both stores on sign out', async () => {
    const { result } = await renderHook(() => useAuth());

    await act(() => {
      useAuthStore.getState().setGuest(true);
    });
    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutUser).toHaveBeenCalled();
    expect(useAuthStore.getState().isGuest).toBe(false);
  });

  it('still clears local state when the network sign-out fails', async () => {
    jest.mocked(signOutUser).mockRejectedValueOnce(new Error('offline'));

    const { result } = await renderHook(() => useAuth());

    await act(() => {
      useAuthStore.getState().setGuest(true);
    });
    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('offline');
    });

    expect(useAuthStore.getState().isGuest).toBe(false);
  });
});
