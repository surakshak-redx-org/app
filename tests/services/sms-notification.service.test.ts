import {
  cancelLocalNotification,
  registerForPushNotifications,
  scheduleLocalNotification,
} from '@/services/notification.service';
import { isSMSAvailable, sendLowBatteryAlert, sendSOSAlert } from '@/services/sms.service';

const CONTACTS = [
  {
    id: 'c1',
    name: 'Ma',
    phone: '+919876543210',
    relationship: 'Mother',
    isPredefined: false,
    order: 7,
  },
];

describe('sms.service stubs', () => {
  it.each([
    ['sendSOSAlert', () => sendSOSAlert(CONTACTS, 'help')],
    ['sendLowBatteryAlert', () => sendLowBatteryAlert(CONTACTS, 'low battery')],
    ['isSMSAvailable', () => isSMSAvailable()],
  ])('%s rejects until its phase lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
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
