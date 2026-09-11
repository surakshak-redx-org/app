import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Updates from 'expo-updates';

import { useOtaUpdate } from '@/hooks/useOtaUpdate';

describe('useOtaUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Updates as { isEnabled: boolean }).isEnabled = true;
  });

  it('checks for an update on mount and reflects an available one', async () => {
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: true,
      manifest: { id: 'update-1' },
    } as never);

    const { result } = await renderHook(() => useOtaUpdate());

    await waitFor(() => {
      expect(result.current.isUpdateAvailable).toBe(true);
    });
    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('stays unavailable when the check finds nothing', async () => {
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: false,
    } as never);

    const { result } = await renderHook(() => useOtaUpdate());

    await waitFor(() => {
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isUpdateAvailable).toBe(false);
  });

  it('fetches and reloads when applying an update', async () => {
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
      isAvailable: false,
    } as never);
    jest
      .mocked(Updates.fetchUpdateAsync)
      .mockResolvedValueOnce({ isNew: true, manifest: { id: 'update-2' } } as never);

    const { result } = await renderHook(() => useOtaUpdate());
    await waitFor(() => expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.applyNow();
    });

    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });
});
