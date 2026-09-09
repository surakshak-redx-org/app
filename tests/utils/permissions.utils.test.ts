import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import {
  checkAllPermissions,
  requestBackgroundLocationPermission,
  requestCameraPermission,
  requestContactsPermission,
  requestLocationPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
} from '@/utils/permissions.utils';

jest.mock('expo-audio', () => ({ requestRecordingPermissionsAsync: jest.fn() }));
jest.mock('expo-camera', () => ({ Camera: { requestCameraPermissionsAsync: jest.fn() } }));
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
}));

const granted = { granted: true };
const denied = { granted: false };

describe('permission requests', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  const cases = [
    ['location', requestLocationPermission, Location.requestForegroundPermissionsAsync],
    [
      'background location',
      requestBackgroundLocationPermission,
      Location.requestBackgroundPermissionsAsync,
    ],
    ['camera', requestCameraPermission, Camera.requestCameraPermissionsAsync],
    ['microphone', requestMicrophonePermission, requestRecordingPermissionsAsync],
    ['contacts', requestContactsPermission, Contacts.requestPermissionsAsync],
    ['notifications', requestNotificationPermission, Notifications.requestPermissionsAsync],
  ] as const;

  it.each(cases)('%s returns true when granted', async (_label, request, native) => {
    jest.mocked(native).mockResolvedValueOnce(granted as never);
    await expect(request()).resolves.toBe(true);
  });

  it.each(cases)('%s returns false when denied', async (_label, request, native) => {
    jest.mocked(native).mockResolvedValueOnce(denied as never);
    await expect(request()).resolves.toBe(false);
  });

  it.each(cases)(
    '%s returns false instead of throwing when the native call fails',
    async (_label, request, native) => {
      jest.mocked(native).mockRejectedValueOnce(new Error('native blew up'));
      await expect(request()).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    },
  );
});

describe('checkAllPermissions', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('reports each permission independently', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValueOnce(granted as never);
    jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValueOnce(denied as never);
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValueOnce(granted as never);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(denied as never);

    await expect(checkAllPermissions()).resolves.toEqual({
      location: true,
      backgroundLocation: false,
      camera: false,
      microphone: false,
      contacts: true,
      notifications: false,
    });
  });

  it('falls back to all-denied when a lookup throws', async () => {
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockRejectedValueOnce(new Error('unavailable'));

    const result = await checkAllPermissions();
    expect(Object.values(result).every((value) => value === false)).toBe(true);
  });
});
