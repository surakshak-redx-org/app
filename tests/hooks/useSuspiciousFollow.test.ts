import { renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { useSuspiciousFollow } from '@/hooks/useSuspiciousFollow';
import { getLocationWithTimeout } from '@/services/location.service';

jest.mock('@/services/location.service', () => ({
  getLocationWithTimeout: jest.fn(),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-1')),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const CHECK_INTERVAL_MS = 60_000;
const START_LAT = 19.076;
const LNG = 72.8777;
const WALK_STEP_DEGREES = 0.001; // ~111 m per minute, normal walking pace

const mockedFix = jest.mocked(getLocationWithTimeout);
let walkStep = 0;

function queueFix(latitude: number, options: { accuracy?: number; ageMs?: number } = {}): void {
  mockedFix.mockImplementationOnce(() =>
    Promise.resolve({
      latitude,
      longitude: LNG,
      accuracy: options.accuracy ?? 5,
      timestamp: Date.now() - (options.ageMs ?? 0),
    }),
  );
}

async function tick(): Promise<void> {
  await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
}

async function walkTicks(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    queueFix(START_LAT + walkStep * WALK_STEP_DEGREES);
    walkStep += 1;
    await tick();
  }
}

async function standStillTicks(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    queueFix(START_LAT + (walkStep - 1) * WALK_STEP_DEGREES);
    await tick();
  }
}

function alertCount(): number {
  return jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.length;
}

describe('useSuspiciousFollow', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFix.mockReset();
    walkStep = 0;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('never alerts a stationary user', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    for (let i = 0; i < 15; i += 1) {
      queueFix(START_LAT);
      await tick();
    }
    expect(alertCount()).toBe(0);
  });

  it('does not alert for GPS jitter around one spot', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    for (let i = 0; i < 15; i += 1) {
      queueFix(START_LAT + (i % 2 === 0 ? 0 : 0.00005)); // ~5 m wobble
      await tick();
    }
    expect(alertCount()).toBe(0);
  });

  it('alerts once after 10 minutes of continuous movement, then not again', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    await walkTicks(10);
    expect(alertCount()).toBe(0);
    await walkTicks(1);
    expect(alertCount()).toBe(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: { type: 'suspicious_follow' } }),
      }),
    );
    await walkTicks(5);
    expect(alertCount()).toBe(1);
  });

  it('does not alert when the user walks then stops', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    await walkTicks(6);
    await standStillTicks(5);
    expect(alertCount()).toBe(0);
  });

  it('ignores inaccurate fixes', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    for (let i = 0; i < 15; i += 1) {
      queueFix(START_LAT + i * WALK_STEP_DEGREES, { accuracy: 200 });
      await tick();
    }
    expect(alertCount()).toBe(0);
  });

  it('ignores stale fixes', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    for (let i = 0; i < 15; i += 1) {
      queueFix(START_LAT + i * WALK_STEP_DEGREES, { ageMs: 120_000 });
      await tick();
    }
    expect(alertCount()).toBe(0);
  });

  it('survives GPS failures without throwing, and restarts the window after an outage', async () => {
    await renderHook(() => useSuspiciousFollow(true));
    await walkTicks(3);
    for (let i = 0; i < 5; i += 1) {
      mockedFix.mockRejectedValueOnce(new Error('errors.locationServicesOff'));
      await tick();
    }
    await walkTicks(10);
    expect(alertCount()).toBe(0); // window restarted: only 10 fresh samples
    await walkTicks(1);
    expect(alertCount()).toBe(1); // 11 fresh samples = a full 10-minute window
  });

  it('does not stack checks while a GPS fix is still pending', async () => {
    mockedFix.mockImplementationOnce(() => new Promise(() => undefined));
    await renderHook(() => useSuspiciousFollow(true));
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 5);
    expect(mockedFix).toHaveBeenCalledTimes(1);
  });

  it('does not sample while disabled', async () => {
    await renderHook(() => useSuspiciousFollow(false));
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3);
    expect(mockedFix).not.toHaveBeenCalled();
  });

  it('stops sampling on unmount', async () => {
    const view = await renderHook(() => useSuspiciousFollow(true));
    await view.unmount();
    queueFix(START_LAT);
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(mockedFix).not.toHaveBeenCalled();
  });
});
