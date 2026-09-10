import { act, renderHook } from '@testing-library/react-native';

import { APP_CONFIG } from '@/constants/config';
import { useSOS } from '@/hooks/useSOS';
import * as analytics from '@/services/analytics.service';
import * as smsService from '@/services/sms.service';
import { useSOSStore } from '@/stores/sos.store';

jest.mock('@/services/sms.service', () => ({
  sendSOSAlert: jest.fn(() => Promise.resolve({ sent: ['+919876543210'], failed: [] })),
  recordSMSAlert: jest.fn(() => Promise.resolve({ id: 'r1' })),
}));

jest.mock('@/services/location.service', () => ({
  getCurrentLocation: jest.fn(() => Promise.resolve({ latitude: 1, longitude: 2, timestamp: 0 })),
  buildLocationUrl: jest.fn(() => 'https://maps/here'),
}));

jest.mock('@/services/analytics.service', () => ({
  trackSosTriggered: jest.fn(),
  trackSosCancelled: jest.fn(),
  trackSmsAlertSent: jest.fn(),
}));

// RNTL 14 made `renderHook` and `act` async — both must be awaited.
describe('useSOS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useSOSStore.getState().reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts inactive with a full countdown', async () => {
    const { result } = await renderHook(() => useSOS());

    expect(result.current.isActive).toBe(false);
    expect(result.current.countdown).toBe(APP_CONFIG.SOS_COUNTDOWN_SECONDS);
  });

  it('a triple-tap inside the window starts the countdown', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.handleTap();
      result.current.handleTap();
      result.current.handleTap();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.triggerMethod).toBe('button');
  });

  it('a single tap does not start the countdown', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.handleTap();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('decrements the countdown once per second', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.trigger('shake');
    });
    await act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.countdown).toBe(APP_CONFIG.SOS_COUNTDOWN_SECONDS - 1);
  });

  it('fans out SMS, records the alert and resets when the countdown elapses', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.trigger('button');
    });
    await act(async () => {
      jest.advanceTimersByTime(APP_CONFIG.SOS_COUNTDOWN_SECONDS * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(smsService.sendSOSAlert).toHaveBeenCalledTimes(1);
    expect(smsService.recordSMSAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sos', locationUrl: 'https://maps/here' }),
    );
    expect(analytics.trackSmsAlertSent).toHaveBeenCalledWith('sos', 1, 0);
    expect(useSOSStore.getState().isActive).toBe(false);
  });

  it('cancel stops the countdown and clears the store', async () => {
    const { result } = await renderHook(() => useSOS());

    await act(() => {
      result.current.trigger('button');
    });
    await act(() => {
      result.current.cancel();
    });

    expect(analytics.trackSosCancelled).toHaveBeenCalledWith('button');
    expect(result.current.isActive).toBe(false);
    expect(result.current.countdown).toBe(APP_CONFIG.SOS_COUNTDOWN_SECONDS);

    // The interval is gone — advancing time does not fan out.
    await act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(smsService.sendSOSAlert).not.toHaveBeenCalled();
  });
});
