import { act, renderHook } from '@testing-library/react-native';

import { APP_CONFIG } from '@/constants/config';
import { useSOS } from '@/hooks/useSOS';
import { useSOSStore } from '@/stores/sos.store';

// RNTL 14 made `renderHook` and `act` async — both must be awaited.
describe('useSOS', () => {
  beforeEach(() => {
    useSOSStore.getState().reset();
  });

  it('starts inactive with a full countdown', async () => {
    const { result } = await renderHook(() => useSOS());

    expect(result.current.isActive).toBe(false);
    expect(result.current.countdown).toBe(APP_CONFIG.SOS_COUNTDOWN_SECONDS);
    expect(result.current.triggerMethod).toBeNull();
  });

  it('records which input triggered the alert', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.trigger('shake');
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.triggerMethod).toBe('shake');
  });

  it('cancelling resets the countdown and clears the trigger', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.trigger('button');
    });
    await act(() => {
      result.current.cancel();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.triggerMethod).toBeNull();
    expect(result.current.countdown).toBe(APP_CONFIG.SOS_COUNTDOWN_SECONDS);
  });
});
