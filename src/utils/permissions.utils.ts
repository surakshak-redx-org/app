import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export type PermissionKey =
  'location' | 'backgroundLocation' | 'camera' | 'microphone' | 'contacts' | 'notifications';

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

/** Reads current status without prompting — safe to call on every app start. */
export async function checkAllPermissions(): Promise<Record<PermissionKey, boolean>> {
  const fallback: Record<PermissionKey, boolean> = {
    location: false,
    backgroundLocation: false,
    camera: false,
    microphone: false,
    contacts: false,
    notifications: false,
  };

  try {
    const [location, backgroundLocation, contacts, notifications] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Contacts.getPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    return {
      ...fallback,
      location: location.granted,
      backgroundLocation: backgroundLocation.granted,
      contacts: contacts.granted,
      notifications: notifications.granted,
    };
  } catch (error) {
    console.error('checkAllPermissions failed:', error);
    return fallback;
  }
}
