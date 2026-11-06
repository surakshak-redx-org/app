import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storage';
import { isReplayOptedOut, setReplayOptOut } from '@/utils/replay-consent.utils';

describe('replay-consent.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is not opted out when nothing has been saved', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    await expect(isReplayOptedOut()).resolves.toBe(false);
  });

  it('is opted out when the flag is saved as true', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('true');
    await expect(isReplayOptedOut()).resolves.toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.REPLAY_OPT_OUT);
  });

  it('is not opted out when the flag is false', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('false');
    await expect(isReplayOptedOut()).resolves.toBe(false);
  });

  it('fails closed (opted out) when storage cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(isReplayOptedOut()).resolves.toBe(true);
    warn.mockRestore();
  });

  it('persists the preference as a string flag', async () => {
    await setReplayOptOut(true);
    await setReplayOptOut(false);
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(1, STORAGE_KEYS.REPLAY_OPT_OUT, 'true');
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(2, STORAGE_KEYS.REPLAY_OPT_OUT, 'false');
  });

  it('rethrows when the preference cannot be saved so the UI can revert', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('full'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(setReplayOptOut(true)).rejects.toThrow('full');
    error.mockRestore();
  });
});
