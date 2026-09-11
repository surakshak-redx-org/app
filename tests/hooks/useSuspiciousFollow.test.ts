import { renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { useSuspiciousFollow } from '@/hooks/useSuspiciousFollow';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-1')),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const CHECK_INTERVAL_MS = 60_000;
// Mumbai — the "shadowed" cluster the user stays in for the back half of the test.
const CLOSE_LAT = 19.076;
const LNG = 72.8777;
// ~5.5km north — well past FOLLOW_MIN_MOVEMENT_METERS from CLOSE_LAT, and only
// ever sampled once, so it ages out of "recent" without leaving the 20-minute
// window (see the walkthrough in the "fires" test below).
const FAR_LAT = 19.126;

function positionAt(latitude: number): void {
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValueOnce({
    coords: { latitude, longitude: LNG, accuracy: 5 },
    timestamp: Date.now(),
  } as never);
}

describe('useSuspiciousFollow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockResolvedValue({ granted: true } as never);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not alert with fewer than 3 location snapshots', async () => {
    positionAt(CLOSE_LAT);
    await renderHook(() => useSuspiciousFollow(true));

    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not alert when the user has not moved far enough', async () => {
    await renderHook(() => useSuspiciousFollow(true));

    for (let i = 0; i < 12; i += 1) {
      positionAt(CLOSE_LAT);

      await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    }

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('fires the alert once movement is followed by staying in the same radius', async () => {
    await renderHook(() => useSuspiciousFollow(true));

    // Tick 1: a single far-away fix — this becomes the "oldest" sample the
    // 20-minute window still remembers once the loop below starts.
    positionAt(FAR_LAT);
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    // Ticks 2–11: ten fixes clustered at the same nearby spot — "moved, then
    // stayed put" is exactly the shape a follower produces. The alert should
    // fire once the far tick ages out of the "recent" (last 10 minutes)
    // window while staying inside the wider 20-minute history — i.e. on the
    // 11th tick (10 minutes after the far one).
    for (let i = 0; i < 10; i += 1) {
      positionAt(CLOSE_LAT);

      await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    }

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: { type: 'suspicious_follow' } }),
      }),
    );

    // Further ticks must not fire it again this session.
    positionAt(CLOSE_LAT);
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('cleans up its interval on unmount', async () => {
    const view = await renderHook(() => useSuspiciousFollow(true));
    await view.unmount();

    positionAt(FAR_LAT);
    await jest.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);

    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
