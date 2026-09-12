import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureException } from '@/config/sentry';
import { PREDEFINED_EMERGENCY_NUMBERS } from '@/constants/emergency-numbers';
import { STORAGE_KEYS } from '@/constants/storage';
import type { EmergencyContact, Language } from '@/types/user.types';

/**
 * Minimal user info needed to build an SOS/battery/journey SMS offline —
 * name and language, nothing that requires a live Firestore read.
 */
export interface OfflineUserCache {
  userId: string;
  name: string;
  language: Language;
}

/**
 * Caches emergency contacts (predefined helplines + the user's own) to
 * AsyncStorage. Called every time contacts load from Firestore, so SOS still
 * has a contact list even when completely offline — see `getEmergencyContacts`
 * in `src/services/firebase/user.service.ts`.
 */
export async function cacheEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  try {
    const all = [...PREDEFINED_EMERGENCY_NUMBERS, ...contacts];
    await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS_CACHE, JSON.stringify(all));
  } catch (error) {
    captureException(error);
  }
}

/**
 * Reads cached emergency contacts, falling back to just the predefined
 * helplines if nothing has ever been cached (e.g. first launch, offline).
 */
export async function getCachedEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS_CACHE);
    if (raw === null) return [...PREDEFINED_EMERGENCY_NUMBERS];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as EmergencyContact[])
      : [...PREDEFINED_EMERGENCY_NUMBERS];
  } catch (error) {
    console.warn('getCachedEmergencyContacts: could not read cache:', error);
    return [...PREDEFINED_EMERGENCY_NUMBERS];
  }
}

/**
 * Caches basic user info (name, language) needed to build an offline SMS
 * message. Called once `surakshakUser` resolves — see `useAuth`.
 */
export async function cacheUserInfo(user: OfflineUserCache): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO_CACHE, JSON.stringify(user));
  } catch (error) {
    captureException(error);
  }
}

export async function getCachedUserInfo(): Promise<OfflineUserCache | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_INFO_CACHE);
    if (raw === null) return null;
    return JSON.parse(raw) as OfflineUserCache;
  } catch (error) {
    console.warn('getCachedUserInfo: could not read cache:', error);
    return null;
  }
}
