import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';

import { firestore, storage } from '@/config/firebase';
import type { CreateUserInput, EmergencyContact, User } from '@/types/user.types';

const USERS_COLLECTION = 'users';

function userDoc(userId: string): ReturnType<typeof doc> {
  return doc(firestore, USERS_COLLECTION, userId);
}

/**
 * Reads a user profile document.
 * @returns the profile, or `null` when the document does not exist.
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const snapshot = await getDoc(userDoc(userId));
    const data = snapshot.data() as Omit<User, 'userId'> | undefined;
    if (data === undefined) return null;

    return { userId: snapshot.id, ...data };
  } catch (error) {
    console.error('getUserProfile failed:', error);
    throw error;
  }
}

/**
 * Creates the profile document for a newly registered user. `state` is written
 * as `''` until a state picker exists; `isGuest` is always `false` here.
 */
export async function createUserProfile(userId: string, input: CreateUserInput): Promise<User> {
  try {
    await setDoc(userDoc(userId), {
      ...input,
      state: '',
      isGuest: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getUserProfile(userId);
    if (created === null) {
      throw new Error('createUserProfile: profile not found after write');
    }
    return created;
  } catch (error) {
    console.error('createUserProfile failed:', error);
    throw error;
  }
}

/** Applies a partial update to a user profile, always bumping `updatedAt`. */
export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
  try {
    await updateDoc(userDoc(userId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('updateUserProfile failed:', error);
    throw error;
  }
}

/** Whether a profile document already exists for this uid. */
export async function doesUserExist(userId: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(userDoc(userId));
    return snapshot.exists();
  } catch (error) {
    console.error('doesUserExist failed:', error);
    throw error;
  }
}

/** Deletes a user's profile document. Used by account deletion. */
export async function deleteUserProfile(userId: string): Promise<void> {
  try {
    await deleteDoc(userDoc(userId));
  } catch (error) {
    console.error('deleteUserProfile failed:', error);
    throw error;
  }
}

/**
 * Uploads a profile photo to Storage and returns its download URL.
 * Overwrites any existing avatar for the user.
 */
export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string> {
  try {
    const avatarRef = ref(storage, `profiles/${userId}/avatar.jpg`);
    await putFile(avatarRef, localUri);
    return await getDownloadURL(avatarRef);
  } catch (error) {
    console.error('uploadProfilePhoto failed:', error);
    throw error;
  }
}

/**
 * Lists a user's emergency contacts, predefined helplines first.
 * @phase Phase 3 — Emergency Core
 */
export function getEmergencyContacts(_userId: string): Promise<EmergencyContact[]> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}

/**
 * Adds a custom emergency contact.
 * @phase Phase 3 — Emergency Core
 */
export function addEmergencyContact(
  _userId: string,
  _contact: Omit<EmergencyContact, 'id'>,
): Promise<EmergencyContact> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}

/**
 * Updates a custom emergency contact.
 * @phase Phase 3 — Emergency Core
 */
export function updateEmergencyContact(
  _userId: string,
  _contactId: string,
  _updates: Partial<EmergencyContact>,
): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}

/**
 * Deletes a custom emergency contact. Predefined helplines cannot be removed.
 * @phase Phase 3 — Emergency Core
 */
export function deleteEmergencyContact(_userId: string, _contactId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}
