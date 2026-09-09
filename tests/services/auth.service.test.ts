import { onAuthStateChanged, signOut } from '@react-native-firebase/auth';

import {
  confirmOtp,
  deleteAccount,
  sendOtp,
  signInAsGuest,
  signOutUser,
  subscribeToAuthChanges,
} from '@/services/firebase/auth.service';

describe('subscribeToAuthChanges', () => {
  it('registers the callback with Firebase and returns the unsubscribe', () => {
    const unsubscribe = jest.fn();
    jest.mocked(onAuthStateChanged).mockReturnValueOnce(unsubscribe);

    const callback = jest.fn();
    const result = subscribeToAuthChanges(callback);

    expect(onAuthStateChanged).toHaveBeenCalledWith(expect.anything(), callback);
    expect(result).toBe(unsubscribe);
  });
});

describe('signOutUser', () => {
  it('delegates to Firebase signOut', async () => {
    jest.mocked(signOut).mockResolvedValueOnce(undefined);
    await expect(signOutUser()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalled();
  });

  it('rethrows so the caller can surface the failure', async () => {
    // The service logs before rethrowing; keep the expected noise out of output.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(signOut).mockRejectedValueOnce(new Error('network'));

    await expect(signOutUser()).rejects.toThrow('network');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

describe('Phase 2 stubs', () => {
  it.each([
    ['sendOtp', () => sendOtp('9876543210')],
    ['confirmOtp', () => confirmOtp('verification-id', '123456')],
    ['signInAsGuest', () => signInAsGuest()],
    ['deleteAccount', () => deleteAccount()],
  ])('%s rejects until Phase 2 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
