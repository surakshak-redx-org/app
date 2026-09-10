import { act, renderHook } from '@testing-library/react-native';

import { useFakeCall } from '@/hooks/useFakeCall';
import * as analytics from '@/services/analytics.service';

jest.mock('@/services/analytics.service', () => ({
  trackFakeCallScheduled: jest.fn(),
  trackFakeCallTriggered: jest.fn(),
}));

describe('useFakeCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
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
});
