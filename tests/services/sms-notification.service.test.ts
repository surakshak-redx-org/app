import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';

import {
  cancelLocalNotification,
  registerForPushNotifications,
  scheduleLocalNotification,
} from '@/services/notification.service';
import {
  clearSMSAlertHistory,
  getSMSAlertHistory,
  isSMSAvailable,
  recordSMSAlert,
  sendLowBatteryAlert,
  sendSOSAlert,
} from '@/services/sms.service';

jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  sendSMSAsync: jest.fn(() => Promise.resolve({ result: 'sent' })),
}));

const CONTACTS = [
  {
    id: 'c1',
    name: 'Ma',
    phone: '9876543210',
    relationship: 'Mother',
    isPredefined: false,
    order: 7,
  },
  {
    id: 'pre_2',
    name: 'Police',
    phone: '100',
    relationship: '',
    isPredefined: true,
    order: 1,
  },
];

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.mocked(SMS.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(SMS.sendSMSAsync).mockResolvedValue({ result: 'sent' } as never);
});

afterEach(() => jest.restoreAllMocks());

describe('isSMSAvailable', () => {
  it('reflects the device capability', async () => {
    jest.mocked(SMS.isAvailableAsync).mockResolvedValueOnce(false);
    await expect(isSMSAvailable()).resolves.toBe(false);
  });
});

describe('sendSOSAlert', () => {
  it('texts only the non-predefined contacts, normalised to E.164', async () => {
    const result = await sendSOSAlert(CONTACTS, 'https://maps/here', 'Priya', 'en');

    expect(SMS.sendSMSAsync).toHaveBeenCalledWith(
      ['+919876543210'],
      expect.stringContaining('Priya'),
    );
    expect(result).toEqual({ sent: ['+919876543210'], failed: [] });
  });

  it('is a no-op when there are no eligible recipients', async () => {
    const result = await sendSOSAlert([CONTACTS[1]!], 'url', 'Priya', 'en');
    expect(SMS.sendSMSAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: [], failed: [] });
  });

  it('marks every recipient failed when SMS is unavailable', async () => {
    jest.mocked(SMS.isAvailableAsync).mockResolvedValue(false);
    const result = await sendSOSAlert(CONTACTS, 'url', 'Priya', 'en');
    expect(result).toEqual({ sent: [], failed: ['+919876543210'] });
  });

  it('marks recipients failed when the user cancels the compose sheet', async () => {
    jest.mocked(SMS.sendSMSAsync).mockResolvedValueOnce({ result: 'cancelled' } as never);
    const result = await sendSOSAlert(CONTACTS, 'url', 'Priya', 'en');
    expect(result).toEqual({ sent: [], failed: ['+919876543210'] });
  });

  it('never throws back into the SOS flow when the SMS module errors', async () => {
    jest.mocked(SMS.sendSMSAsync).mockRejectedValueOnce(new Error('sim missing'));
    const result = await sendSOSAlert(CONTACTS, 'url', 'Priya', 'en');
    expect(result).toEqual({ sent: [], failed: ['+919876543210'] });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('sendLowBatteryAlert', () => {
  it('sends the low-battery copy to eligible contacts', async () => {
    await sendLowBatteryAlert(CONTACTS, 'https://maps/here', 'Priya', 'en');
    expect(SMS.sendSMSAsync).toHaveBeenCalledWith(
      ['+919876543210'],
      expect.stringContaining('battery'),
    );
  });
});

describe('SMS alert history', () => {
  it('round-trips a record through AsyncStorage, newest first', async () => {
    const store = new Map<string, string>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null));
    jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    });

    const first = await recordSMSAlert({
      type: 'sos',
      locationUrl: 'u1',
      contactsSent: ['a'],
      contactsFailed: [],
    });
    const second = await recordSMSAlert({
      type: 'low_battery',
      locationUrl: 'u2',
      contactsSent: [],
      contactsFailed: ['b'],
    });

    const history = await getSMSAlertHistory();
    expect(history.map((record) => record.id)).toEqual([second.id, first.id]);
    expect(history[0]).toMatchObject({ type: 'low_battery', contactsFailed: ['b'] });
  });

  it('returns an empty list when nothing has been stored', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    await expect(getSMSAlertHistory()).resolves.toEqual([]);
  });

  it('clears the stored history', async () => {
    await clearSMSAlertHistory();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('surakshak_sms_history');
  });
});

describe('notification.service stubs', () => {
  it.each([
    [
      'scheduleLocalNotification',
      () => scheduleLocalNotification('Check in', 'Are you safe?', 300),
    ],
    ['cancelLocalNotification', () => cancelLocalNotification('notification-1')],
    ['registerForPushNotifications', () => registerForPushNotifications('user-1')],
  ])('%s rejects until its phase lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
