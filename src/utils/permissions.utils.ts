import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionKey =
  | 'location'
  | 'backgroundLocation'
  | 'camera'
  | 'microphone'
  | 'contacts'
  | 'notifications'
  | 'sms';

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestLocationPermission failed:', error);
    return false;
  }
}

/**
 * Only ever request this after foreground location is already granted — both
 * platforms reject a cold background request.
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.requestBackgroundPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestBackgroundLocationPermission failed:', error);
    return false;
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { granted } = await Camera.requestCameraPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestCameraPermission failed:', error);
    return false;
  }
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestMicrophonePermission failed:', error);
    return false;
  }
}

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { granted } = await Contacts.requestPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestContactsPermission failed:', error);
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { granted } = await Notifications.requestPermissionsAsync();
    return granted;
  } catch (error) {
    console.error('requestNotificationPermission failed:', error);
    return false;
  }
}

/**
 * Android's silent SOS SMS (`SmsManager`) and direct helpline calls both need
 * runtime grants — declaring them in `app.config.ts` is not enough on
 * Android 6+. iOS has no such permission (it always uses the compose sheet /
 * dialer), so it reports granted.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
    ]);
    return results[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.error('requestSmsPermission failed:', error);
    return false;
  }
}

async function checkSmsGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
}

/** Reads current status without prompting — safe to call on every app start. */
export async function checkAllPermissions(): Promise<Record<PermissionKey, boolean>> {
  const fallback: Record<PermissionKey, boolean> = {
    location: false,
    backgroundLocation: false,
    camera: false,
    microphone: false,
    contacts: false,
    notifications: false,
    sms: false,
  };

  try {
    const [location, backgroundLocation, contacts, notifications, sms] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Contacts.getPermissionsAsync(),
      Notifications.getPermissionsAsync(),
      checkSmsGranted(),
    ]);

    return {
      ...fallback,
      location: location.granted,
      backgroundLocation: backgroundLocation.granted,
      contacts: contacts.granted,
      notifications: notifications.granted,
      sms,
    };
  } catch (error) {
    console.error('checkAllPermissions failed:', error);
    return fallback;
  }
}
