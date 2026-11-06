import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_FLAG_OFF, STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';

/**
 * Whether the user has opted out of session replay.
 *
 * Fails closed: if the preference cannot be read, replay stays off. Recording a
 * user who may have opted out is a worse mistake than missing one replay.
 */
export async function isReplayOptedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.REPLAY_OPT_OUT)) === STORAGE_FLAG_ON;
  } catch (error) {
    console.warn('isReplayOptedOut: could not read preference, treating as opted out:', error);
    return true;
  }
}

export async function setReplayOptOut(optedOut: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.REPLAY_OPT_OUT,
      optedOut ? STORAGE_FLAG_ON : STORAGE_FLAG_OFF,
    );
  } catch (error) {
    console.error('setReplayOptOut failed:', error);
    throw error;
  }
}
