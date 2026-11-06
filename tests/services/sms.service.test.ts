import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';
import { Platform } from 'react-native';
import { checkSmsPermission, isAirplaneModeOn, sendSmsToContacts } from 'surakshak-native';

import { captureException, recordBreadcrumb } from '@/config/sentry';
import {
  clearPendingOutbox,
  flushPendingOutbox,
  getPendingOutbox,
  sendLowBatteryAlert,
  sendSafeJourneyArrived,
  sendSafeJourneyCancelled,
  sendSOSAlert,
} from '@/services/sms.service';
import type { EmergencyContact } from '@/types/user.types';

jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  sendSMSAsync: jest.fn(() => Promise.resolve({ result: 'sent' })),
}));

jest.mock('@/config/sentry', () => ({
  captureException: jest.fn(),
  recordBreadcrumb: jest.fn(),
}));

const mockedSendSmsToContacts = jest.mocked(sendSmsToContacts);
const mockedSendSMSAsync = jest.mocked(SMS.sendSMSAsync);

const contact = (overrides: Partial<EmergencyContact> = {}): EmergencyContact => ({
  id: 'c1',
  name: 'Mom',
  phone: '9876543210',
  relationship: 'Mother',
  isPredefined: false,
  order: 0,
  ...overrides,
});

describe('sms.service', () => {
  const originalOS = Platform.OS;
  let storage = new Map<string, string>();

  beforeEach(() => {
    storage = new Map<string, string>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) => Promise.resolve(storage.get(key) ?? null));
    jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });
    jest.mocked(checkSmsPermission).mockResolvedValue(true);
  });

  afterEach(async () => {
    Platform.OS = originalOS;
    await clearPendingOutbox();
    jest.clearAllMocks();
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      jest.mocked(checkSmsPermission).mockResolvedValue(true);
    });

    it('sendSOSAlert calls sendSmsToContacts with recipient numbers and the SOS message', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('Asha'),
      );
      expect(result).toEqual({ sent: ['+919876543210'], failed: [] });
    });

    it('uses the custom template from AsyncStorage when available', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);
      jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('CUSTOM HELP: {name} at {location}');

      await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        'CUSTOM HELP: Asha at https://maps.example/1',
      );
    });

    it('detects Airplane mode, flags isAirplaneMode, marks recipients failed, and enqueues to outbox', async () => {
      jest.mocked(isAirplaneModeOn).mockResolvedValueOnce(true);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(mockedSendSMSAsync).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: [], failed: ['+919876543210'], isAirplaneMode: true });

      const pending = await getPendingOutbox();
      expect(pending.length).toBe(1);
      expect(pending[0]?.recipients).toEqual(['+919876543210']);
    });

    it('handles native AIRPLANE_MODE_ON error during silent send', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        {
          success: false,
          phone: '+919876543210',
          error: 'AIRPLANE_MODE_ON: Airplane mode',
          method: 'direct',
        },
      ]);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(result).toEqual({ sent: [], failed: ['+919876543210'], isAirplaneMode: true });
      const pending = await getPendingOutbox();
      expect(pending.length).toBe(1);
    });

    it('enqueues ONLY failed recipients when partial failure has airplane error', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        {
          success: true,
          phone: '+919876543210',
          method: 'direct',
        },
        {
          success: false,
          phone: '+918765432109',
          error: 'AIRPLANE_MODE_ON: Airplane mode',
          method: 'direct',
        },
      ]);

      const result = await sendSOSAlert(
        [contact(), contact({ id: 'c2', phone: '8765432109' })],
        'https://maps.example/1',
        'Asha',
        'en',
      );

      expect(result).toEqual({
        sent: ['+919876543210'],
        failed: ['+918765432109'],
        isAirplaneMode: true,
      });
      const pending = await getPendingOutbox();
      expect(pending.length).toBe(1);
      expect(pending[0]?.recipients).toEqual(['+918765432109']);
    });

    it('survives AsyncStorage failure during template retrieval', async () => {
      jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('Storage failure'));
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');
      expect(result.sent).toEqual(['+919876543210']);
    });

    it('bails on flush if airplane mode is still on and preserves outbox', async () => {
      jest.mocked(checkSmsPermission).mockResolvedValueOnce(false);
      await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      // Now permission granted, but airplane mode is ON
      jest.mocked(checkSmsPermission).mockResolvedValue(true);
      jest.mocked(isAirplaneModeOn).mockResolvedValueOnce(true);

      const flushed = await flushPendingOutbox();
      expect(flushed.dispatched).toBe(0);
      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();

      const remaining = await getPendingOutbox();
      expect(remaining.length).toBe(1);
    });

    it('retains partially failed items in outbox during flush', async () => {
      jest.mocked(checkSmsPermission).mockResolvedValueOnce(false);
      await sendSOSAlert(
        [contact(), contact({ id: 'c2', phone: '8765432109' })],
        'https://maps.example/1',
        'Asha',
        'en',
      );

      jest.mocked(checkSmsPermission).mockResolvedValue(true);
      jest.mocked(isAirplaneModeOn).mockResolvedValue(false);
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
        { success: false, phone: '+918765432109', method: 'direct', error: 'RADIO_NOT_AVAILABLE' },
      ]);

      const flushed = await flushPendingOutbox();
      expect(flushed.dispatched).toBe(1);

      const remaining = await getPendingOutbox();
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.recipients).toEqual(['+918765432109']);
    });

    it('falls back to the compose sheet when SEND_SMS has not been granted and enqueues to outbox', async () => {
      jest.mocked(checkSmsPermission).mockResolvedValueOnce(false);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(mockedSendSMSAsync).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('Asha'),
      );
      expect(result).toEqual({ sent: [], failed: ['+919876543210'], isDraftFallback: true });

      const pending = await getPendingOutbox();
      expect(pending.length).toBe(1);
      expect(pending[0]?.recipients).toEqual(['+919876543210']);
    });

    it('drains queued outbox messages once permission is granted', async () => {
      jest.mocked(checkSmsPermission).mockResolvedValueOnce(false);
      await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      jest.mocked(checkSmsPermission).mockResolvedValueOnce(true);
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      const flushed = await flushPendingOutbox();
      expect(flushed.dispatched).toBe(1);
      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('Asha'),
      );

      const remaining = await getPendingOutbox();
      expect(remaining.length).toBe(0);
    });

    it('falls back to the compose sheet when the permission lookup throws', async () => {
      jest.mocked(checkSmsPermission).mockRejectedValueOnce(new Error('no module'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(mockedSendSMSAsync).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('excludes predefined helpline contacts from the recipient list entirely', async () => {
      const result = await sendSOSAlert(
        [contact({ id: 'pre_1', isPredefined: true, phone: '112' })],
        'https://maps.example/1',
        'Asha',
        'en',
      );

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: [], failed: [] });
    });

    it('returns empty arrays and skips the native call when there are no contacts', async () => {
      const result = await sendSOSAlert([], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: [], failed: [] });
    });

    it('reports per-recipient failures from a mixed result', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
        { success: false, phone: '+918765432109', method: 'direct', error: 'SMS_FAILED' },
      ]);

      const result = await sendSOSAlert(
        [contact(), contact({ id: 'c2', phone: '8765432109' })],
        'https://maps.example/1',
        'Asha',
        'en',
      );

      expect(result).toEqual({
        sent: ['+919876543210'],
        failed: ['+918765432109'],
      });
    });

    it('fails every recipient rather than throwing when the native call rejects', async () => {
      mockedSendSmsToContacts.mockRejectedValueOnce(new Error('native module crashed'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(result).toEqual({ sent: [], failed: ['+919876543210'] });
      expect(errorSpy).toHaveBeenCalled();
      // The failure is swallowed, so this capture is the only way it surfaces.
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'native module crashed' }),
        { domain: 'SOS', operation: 'smsDispatchNative', extra: { recipientCount: 1 } },
      );
      errorSpy.mockRestore();
    });

    it('records a breadcrumb with counts only, never recipients', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
        { success: false, phone: '+918765432109', method: 'direct', error: 'no signal' },
      ]);

      await sendSOSAlert(
        [contact(), contact({ id: 'c2', phone: '8765432109' })],
        'https://maps.example/1',
        'Asha',
        'en',
      );

      expect(recordBreadcrumb).toHaveBeenCalledWith('sms dispatch result', {
        domain: 'SOS',
        data: { sent: 1, failed: 1 },
      });
      expect(captureException).not.toHaveBeenCalled();
    });

    it('sendLowBatteryAlert uses the low-battery message template', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      await sendLowBatteryAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('battery'),
      );
    });

    it('sendSafeJourneyArrived dispatches the safe arrival message', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      const result = await sendSafeJourneyArrived([contact()], 'Home', 'Asha', 'en');

      expect(result).toEqual({ sent: ['+919876543210'], failed: [] });
      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('arrived safely at Home'),
      );
    });

    it('sendSafeJourneyCancelled dispatches the safe cancellation message', async () => {
      mockedSendSmsToContacts.mockResolvedValueOnce([
        { success: true, phone: '+919876543210', method: 'direct' },
      ]);

      const result = await sendSafeJourneyCancelled([contact()], 'Office', 'Asha', 'en');

      expect(result).toEqual({ sent: ['+919876543210'], failed: [] });
      expect(mockedSendSmsToContacts).toHaveBeenCalledWith(
        ['+919876543210'],
        expect.stringContaining('ended the Safe Journey to Office'),
      );
    });
  });

  describe('on iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('never calls the native direct-send path, using the expo-sms compose sheet instead', async () => {
      const result = await sendSOSAlert([contact()], 'https://maps.example/1', 'Asha', 'en');

      expect(mockedSendSmsToContacts).not.toHaveBeenCalled();
      expect(mockedSendSMSAsync).toHaveBeenCalledWith(['+919876543210'], expect.any(String));
      expect(result).toEqual({ sent: ['+919876543210'], failed: [] });
    });
  });
});
