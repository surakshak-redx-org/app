import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { STORAGE_KEYS } from '@/constants/storage';
import { useSafeCheckin } from '@/hooks/useSafeCheckin';
import {
  cancelLocalNotification,
  scheduleLocalNotification,
} from '@/services/notification.service';
import { recordSMSAlert, sendCheckInMissedAlert } from '@/services/sms.service';
import { useUserStore } from '@/stores/user.store';

jest.mock('@/services/notification.service', () => ({
  scheduleLocalNotification: jest.fn(() => Promise.resolve('notification-1')),
  cancelLocalNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/sms.service', () => ({
  sendCheckInMissedAlert: jest.fn(() => Promise.resolve({ sent: ['+919876543210'], failed: [] })),
  recordSMSAlert: jest.fn(() => Promise.resolve()),
}));

const CONTACT = {
  id: 'c1',
  name: 'Ma',
  phone: '9876543210',
  relationship: 'Mother',
  isPredefined: false,
  order: 0,
};

function makeStore(): Map<string, string> {
  const store = new Map<string, string>();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null));
  jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  });
  jest
    .mocked(AsyncStorage.multiSet)
    .mockImplementation((entries: readonly (readonly [string, string])[]) => {
      for (const [key, value] of entries) store.set(key, value);
      return Promise.resolve();
    });
  jest
    .mocked(AsyncStorage.multiGet)
    .mockImplementation((keys: readonly string[]) =>
      Promise.resolve(keys.map((key) => [key, store.get(key) ?? null] as [string, string | null])),
    );
  jest.mocked(AsyncStorage.multiRemove).mockImplementation((keys: readonly string[]) => {
    for (const key of keys) store.delete(key);
    return Promise.resolve();
  });
  return store;
}

describe('useSafeCheckin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeStore();
    useUserStore.getState().setEmergencyContacts([CONTACT]);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    useUserStore.getState().reset();
  });

  it('start() persists the session and schedules a notification for the chosen interval', async () => {
    const { result } = await renderHook(() => useSafeCheckin());

    await act(() => {
      result.current.setIntervalMinutes(30);
      result.current.setSelectedContactIds(['c1']);
    });
    await act(async () => {
      await result.current.start();
    });

    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_ACTIVE)).toBe('true');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_INTERVAL_MINUTES)).toBe('30');
    expect(scheduleLocalNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      30 * 60,
      { type: 'safe_checkin' },
    );
    expect(result.current.isActive).toBe(true);
  });

  it('checkIn() resets the missed count and reschedules', async () => {
    const { result } = await renderHook(() => useSafeCheckin());

    await act(async () => {
      result.current.setSelectedContactIds(['c1']);
      await result.current.start();
    });
    await act(async () => {
      await result.current.checkIn();
    });

    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_MISSED_COUNT)).toBe('0');
    expect(result.current.missedCount).toBe(0);
    expect(cancelLocalNotification).toHaveBeenCalled();
  });

  it('stop() clears every persisted key and cancels the notification', async () => {
    const { result } = await renderHook(() => useSafeCheckin());

    await act(async () => {
      result.current.setSelectedContactIds(['c1']);
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_ACTIVE)).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(cancelLocalNotification).toHaveBeenCalled();
  });

  it('reschedules a reminder on a missed check-in below the alert threshold', async () => {
    const store = makeStore();
    store.set(STORAGE_KEYS.CHECKIN_ACTIVE, 'true');
    store.set(STORAGE_KEYS.CHECKIN_NEXT_AT, new Date(Date.now() - 60_000).toISOString());
    store.set(STORAGE_KEYS.CHECKIN_MISSED_COUNT, '0');
    store.set(STORAGE_KEYS.CHECKIN_CONTACT_IDS, JSON.stringify(['c1']));

    await renderHook(() => useSafeCheckin());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_MISSED_COUNT)).toBe('1');
    expect(sendCheckInMissedAlert).not.toHaveBeenCalled();
  });

  it('sends the SMS alert and stops once the miss count reaches the threshold', async () => {
    const store = makeStore();
    store.set(STORAGE_KEYS.CHECKIN_ACTIVE, 'true');
    store.set(STORAGE_KEYS.CHECKIN_NEXT_AT, new Date(Date.now() - 60_000).toISOString());
    store.set(STORAGE_KEYS.CHECKIN_MISSED_COUNT, '1');
    store.set(STORAGE_KEYS.CHECKIN_CONTACT_IDS, JSON.stringify(['c1']));

    await renderHook(() => useSafeCheckin());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(sendCheckInMissedAlert).toHaveBeenCalled();
    expect(recordSMSAlert).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_ACTIVE)).toBeNull();
  });
});
