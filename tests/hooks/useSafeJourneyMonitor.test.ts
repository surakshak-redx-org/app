import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { APP_CONFIG } from '@/constants/config';
import { useSafeJourneyMonitor } from '@/hooks/useSafeJourneyMonitor';
import * as analytics from '@/services/analytics.service';
import * as journeyService from '@/services/firebase/safe-journey.service';
import * as notificationService from '@/services/notification.service';
import * as smsService from '@/services/sms.service';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';

jest.mock('@/services/firebase/safe-journey.service', () => ({
  getActiveJourneySession: jest.fn(() => Promise.resolve(null)),
  markAlertSent: jest.fn(() => Promise.resolve()),
  cancelSafeJourney: jest.fn(() => Promise.resolve()),
  markSafeJourneyArrived: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/notification.service', () => ({
  scheduleLocalNotification: jest.fn(() => Promise.resolve('id')),
  cancelLocalNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/sms.service', () => ({
  sendSafeJourneyAlert: jest.fn(() => Promise.resolve({ sent: ['+919876543210'], failed: [] })),
  recordSMSAlert: jest.fn(() => Promise.resolve({ id: 'r1' })),
}));

jest.mock('@/services/location.service', () => ({
  getLocationWithTimeout: jest.fn(() =>
    Promise.resolve({ latitude: 1, longitude: 2, timestamp: 0 }),
  ),
  buildLocationUrl: jest.fn((lat: number, lng: number) => `https://maps/${lat},${lng}`),
}));

jest.mock('@/services/analytics.service', () => ({
  trackSafeJourneyAlertSent: jest.fn(),
  trackSmsAlertSent: jest.fn(),
}));

const MINUTE = 60_000;
const GRACE_MS = APP_CONFIG.SAFE_JOURNEY_OVERDUE_GRACE_SECONDS * 1000;

function session(expectedArrival: Date): Record<string, unknown> {
  return {
    id: 'j1',
    userId: 'u1',
    destinationName: 'Andheri',
    destinationLatitude: 19,
    destinationLongitude: 72,
    etaMinutes: 30,
    sharedWithUserIds: ['c1'],
    startedAt: { toDate: () => new Date() },
    expectedArrivalAt: { toDate: () => expectedArrival },
    status: 'active',
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

describe('useSafeJourneyMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useLocationStore.getState().reset();
    useUserStore.setState({
      emergencyContacts: [
        {
          id: 'c1',
          name: 'Mom',
          phone: '9876543210',
          relationship: 'Mother',
          isPredefined: false,
          order: 0,
        },
      ],
    } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing without a signed-in user', async () => {
    await renderHook(() => useSafeJourneyMonitor(null));
    await flush();
    expect(journeyService.getActiveJourneySession).not.toHaveBeenCalled();
  });

  it('marks the journey active and schedules the warning and due reminders', async () => {
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(new Date(Date.now() + 30 * MINUTE)) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(useLocationStore.getState().isSafeJourneyActive).toBe(true);
    expect(notificationService.scheduleLocalNotification).toHaveBeenCalledTimes(2);
    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
  });

  it('texts contacts on its own once the deadline and the grace period have passed', async () => {
    const deadline = new Date(Date.now() + 2 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();
    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2 * MINUTE + GRACE_MS + 1000);
    });

    expect(journeyService.markAlertSent).toHaveBeenCalledWith('j1');
    expect(smsService.sendSafeJourneyAlert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'c1' })],
      'https://maps/1,2',
      expect.any(String),
      'Andheri',
      expect.any(String),
      expect.any(String),
    );
    expect(useLocationStore.getState().isSafeJourneyActive).toBe(false);
  });

  it('does not text contacts the moment the deadline passes', async () => {
    const deadline = new Date(Date.now() + 2 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    // Just past the deadline, but well inside the grace period.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2 * MINUTE + 30_000);
    });

    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
    expect(journeyService.markAlertSent).not.toHaveBeenCalled();
    // Still active, so the user can confirm they are safe.
    expect(useLocationStore.getState().isSafeJourneyActive).toBe(true);
  });

  it('does not alert if the user confirms they are safe during the grace period', async () => {
    const deadline = new Date(Date.now() + 1 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1 * MINUTE + 30_000);
    });
    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();

    // The user taps "I've arrived": the journey is no longer active.
    jest.mocked(journeyService.getActiveJourneySession).mockResolvedValue(null);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(GRACE_MS);
    });

    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
    expect(analytics.trackSafeJourneyAlertSent).not.toHaveBeenCalled();
  });

  it('keeps a journey active, without re-scheduling reminders, when found inside its grace period', async () => {
    const deadline = new Date(Date.now() - 1 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(useLocationStore.getState().isSafeJourneyActive).toBe(true);
    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
    // The reminders already fired; scheduling again would use a negative delay.
    expect(notificationService.scheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('texts contacts straight away when found already past deadline plus grace', async () => {
    const deadline = new Date(Date.now() - GRACE_MS - 1 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(smsService.sendSafeJourneyAlert).toHaveBeenCalledTimes(1);
  });

  it('tells the user how long they have in the due reminder', async () => {
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(new Date(Date.now() + 30 * MINUTE)) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    const bodies = jest
      .mocked(notificationService.scheduleLocalNotification)
      .mock.calls.map((call) => call[1]);
    const minutes = String(APP_CONFIG.SAFE_JOURNEY_OVERDUE_GRACE_SECONDS / 60);
    expect(bodies.some((body) => body.includes(`${minutes} minutes`))).toBe(true);
    expect(bodies.some((body) => body.includes('are being alerted'))).toBe(false);
  });

  it('reports how many contacts the overdue alert reached', async () => {
    jest.mocked(smsService.sendSafeJourneyAlert).mockResolvedValueOnce({
      sent: ['+919876543210'],
      failed: ['+918765432109', '+917654321098'],
    });
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(new Date(Date.now() - GRACE_MS - 1 * MINUTE)) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(analytics.trackSafeJourneyAlertSent).toHaveBeenCalledWith(1, 2);
    expect(analytics.trackSmsAlertSent).toHaveBeenCalledWith('safe_journey', 1, 2);
  });

  it('records an alert that reached nobody as such, rather than as a success', async () => {
    jest.mocked(smsService.sendSafeJourneyAlert).mockResolvedValueOnce({ sent: [], failed: [] });
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(new Date(Date.now() - GRACE_MS - 1 * MINUTE)) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(analytics.trackSafeJourneyAlertSent).toHaveBeenCalledWith(0, 0);
  });

  it('quietly closes a journey that went stale while the app was closed', async () => {
    const longAgo = new Date(Date.now() - (APP_CONFIG.SAFE_JOURNEY_STALE_HOURS + 1) * 60 * MINUTE);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(longAgo) as never);

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(journeyService.cancelSafeJourney).toHaveBeenCalledWith('j1');
    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
  });

  it('re-reads the journey when a screen bumps the revision', async () => {
    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();
    expect(journeyService.getActiveJourneySession).toHaveBeenCalledTimes(1);

    await act(() => {
      useLocationStore.getState().bumpSafeJourneyRevision();
    });
    await flush();

    expect(journeyService.getActiveJourneySession).toHaveBeenCalledTimes(2);
    expect(notificationService.cancelLocalNotification).toHaveBeenCalled();
  });

  it('does not alert if the session was marked arrived offline', async () => {
    const deadline = new Date(Date.now() - 1000);
    jest
      .mocked(journeyService.getActiveJourneySession)
      .mockResolvedValue(session(deadline) as never);
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(['j1']));

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(smsService.sendSafeJourneyAlert).not.toHaveBeenCalled();
    expect(useLocationStore.getState().isSafeJourneyActive).toBe(false);
  });

  it('does not restore cached journey belonging to a different user', async () => {
    // Earlier tests leave a session in the shared mock; this one is about the
    // cache alone, so start from "no active journey on the server".
    jest.mocked(journeyService.getActiveJourneySession).mockResolvedValue(null);
    const deadline = Date.now() + 10 * MINUTE;
    const storageMap = new Map<string, string>([
      ['surakshak_safe_journey_session_id', 'j_other'],
      ['surakshak_safe_journey_deadline', String(deadline)],
      ['surakshak_safe_journey_user_id', 'different_user'],
    ]);
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) => Promise.resolve(storageMap.get(key) ?? null));

    await renderHook(() => useSafeJourneyMonitor('u1'));
    await flush();

    expect(useLocationStore.getState().isSafeJourneyActive).toBe(false);
  });
});
