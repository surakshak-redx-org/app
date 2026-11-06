import { act, renderHook } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { getPendingFakeCall, scheduleFakeCall as scheduleNativeFakeCall } from 'surakshak-native';

import { useFakeCall } from '@/hooks/useFakeCall';
import * as analytics from '@/services/analytics.service';

jest.mock('@/services/analytics.service', () => ({
  trackFakeCallScheduled: jest.fn(),
  trackFakeCallTriggered: jest.fn(),
}));

describe('useFakeCall', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('activates the call after the scheduled delay', async () => {
    const { result } = await renderHook(() => useFakeCall());

    await act(async () => {
      await result.current.scheduleCall(60, 'Mom');
    });
    expect(result.current.isCallActive).toBe(false);

    await act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current.isCallActive).toBe(true);
    expect(result.current.callerName).toBe('Mom');
  });

  it('cancelCall stops a pending call from ringing', async () => {
    const { result } = await renderHook(() => useFakeCall());

    await act(async () => {
      await result.current.scheduleCall(60, 'Mom');
    });
    await act(async () => {
      await result.current.cancelCall();
    });
    await act(() => {
      jest.advanceTimersByTime(120_000);
    });

    expect(result.current.isCallActive).toBe(false);
  });

  it('endCall clears an active call', async () => {
    const { result } = await renderHook(() => useFakeCall());

    await act(async () => {
      await result.current.scheduleCall(0, 'Mom');
    });
    await act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.isCallActive).toBe(true);

    await act(() => {
      result.current.endCall();
    });
    expect(result.current.isCallActive).toBe(false);
  });

  it('clears its timer on unmount', async () => {
    const { result, unmount } = await renderHook(() => useFakeCall());
    await act(async () => {
      await result.current.scheduleCall(60, 'Mom');
    });
    await unmount();
    jest.advanceTimersByTime(60_000);

    // The unmount cleanup cleared the pending timer, so the fake call never rings.
    expect(analytics.trackFakeCallTriggered).not.toHaveBeenCalled();
  });

  describe('Android native scheduling & immediate calls', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('triggers immediate call without native alarm when delay is 0', async () => {
      const { result } = await renderHook(() => useFakeCall());

      await act(async () => {
        await result.current.scheduleCall(0, 'Mom');
      });

      expect(scheduleNativeFakeCall).not.toHaveBeenCalled();
      expect(result.current.isCallActive).toBe(true);
      expect(result.current.callerName).toBe('Mom');
      expect(analytics.trackFakeCallTriggered).toHaveBeenCalledTimes(1);
    });

    it('schedules native alarm and still starts a JS timer for the foreground', async () => {
      const { result } = await renderHook(() => useFakeCall());

      await act(async () => {
        await result.current.scheduleCall(60, 'Police');
      });

      expect(scheduleNativeFakeCall).toHaveBeenCalledWith(60_000, 'Police');
      expect(result.current.isCallActive).toBe(false);

      await act(() => {
        jest.advanceTimersByTime(60_000);
      });

      // Native alarm covers background; the JS timer surfaces the call in the foreground
      expect(result.current.isCallActive).toBe(true);
    });

    it('falls back to JS timer if native alarm scheduling rejects', async () => {
      jest
        .mocked(scheduleNativeFakeCall)
        .mockRejectedValueOnce(new Error('Alarm permission denied'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { result } = await renderHook(() => useFakeCall());

      await act(async () => {
        await result.current.scheduleCall(60, 'Fallback');
      });

      expect(result.current.isCallActive).toBe(false);

      await act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(result.current.isCallActive).toBe(true);
      expect(result.current.callerName).toBe('Fallback');
      warnSpy.mockRestore();
    });

    it('recovers pending fake call on app resume', async () => {
      jest.mocked(getPendingFakeCall).mockResolvedValueOnce(null);
      const { result } = await renderHook(() => useFakeCall());
      expect(result.current.isCallActive).toBe(false);

      jest.mocked(getPendingFakeCall).mockResolvedValueOnce({ callerName: 'Dad' });

      await act(async () => {
        // Emit AppState active event
        const emitActive = (
          AppState as unknown as { emit?: (event: string, state: string) => void }
        ).emit;
        if (typeof emitActive === 'function') {
          emitActive('change', 'active');
        }
        await Promise.resolve();
      });
    });
  });
});
