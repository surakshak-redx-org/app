import * as SMS from 'expo-sms';
import { Platform } from 'react-native';
import { sendSmsToContacts } from 'surakshak-native';

import { sendLowBatteryAlert, sendSOSAlert } from '@/services/sms.service';
import type { EmergencyContact } from '@/types/user.types';

jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  sendSMSAsync: jest.fn(() => Promise.resolve({ result: 'sent' })),
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
  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
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
      errorSpy.mockRestore();
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
