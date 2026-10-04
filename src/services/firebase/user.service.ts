import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';

import { firestore, storage } from '@/config/firebase';
import type { CreateUserInput, EmergencyContact, User } from '@/types/user.types';
import { cacheEmergencyContacts } from '@/utils/offline-cache.utils';
import { formatIndianPhone, toNationalDigits } from '@/utils/phone.utils';

const USERS_COLLECTION = 'users';
const CONTACTS_SUBCOLLECTION = 'emergencyContacts';
/** Prefix for contact documents keyed by their E.164 digits, e.g. `phone_919876543210`. */
const CONTACT_ID_PREFIX = 'phone_';
/** Country code without `+`, as some older documents store it. */
const INDIA_DIAL_PREFIX = '91';

/**
 * Thrown by `addEmergencyContact` when the phone number is already saved.
 * Carries no contact data so it is safe to log; screens map it to
 * `emergency.contactAlreadyExists` instead of a generic save failure.
 */
export class DuplicateContactError extends Error {
  public constructor() {
    super('emergency.contactAlreadyExists');
    this.name = 'DuplicateContactError';
  }
}

function userDoc(userId: string): ReturnType<typeof doc> {
  return doc(firestore, USERS_COLLECTION, userId);
}

function contactsCollection(userId: string): ReturnType<typeof collection> {
  return collection(firestore, USERS_COLLECTION, userId, CONTACTS_SUBCOLLECTION);
}

function contactDoc(userId: string, contactId: string): ReturnType<typeof doc> {
  return doc(firestore, USERS_COLLECTION, userId, CONTACTS_SUBCOLLECTION, contactId);
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
 * Lists a user's custom emergency contacts, ordered by `order`. Predefined
 * helplines are not stored in Firestore — the UI prepends them from
 * `PREDEFINED_EMERGENCY_NUMBERS`.
 */
export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  try {
    const snapshot = await getDocs(query(contactsCollection(userId), orderBy('order', 'asc')));
    const contacts = snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<EmergencyContact, 'id'>),
    }));
    // Cache locally so SOS/battery alerts still have a contact list if a
    // later read has to happen fully offline — see offline-cache.utils.ts.
    await cacheEmergencyContacts(contacts);
    return contacts;
  } catch (error) {
    console.error('getEmergencyContacts failed:', error);
    throw error;
  }
}

/**
 * Every stored form a phone number may have — older documents (or ones edited
 * by hand in the console) are not always E.164, and Firestore cannot normalise
 * inside a query.
 */
function storedPhoneVariants(phone: string): string[] {
  const national = toNationalDigits(phone);
  return [...new Set([formatIndianPhone(phone), national, `${INDIA_DIAL_PREFIX}${national}`])];
}

/**
 * Adds a custom emergency contact and returns it with its id.
 *
 * Duplicates are guarded twice: a query rejects a number already stored in any
 * form, and new documents are keyed by the phone number itself, so two adds
 * racing past the query (double tap, two devices) write the same document
 * instead of two. A keyed `setDoc` also keeps working offline, unlike a
 * transaction.
 * @throws DuplicateContactError when the number is already saved.
 */
export async function addEmergencyContact(
  userId: string,
  contact: Omit<EmergencyContact, 'id'>,
): Promise<EmergencyContact> {
  try {
    const duplicateSnap = await getDocs(
      query(
        contactsCollection(userId),
        where('phone', 'in', storedPhoneVariants(contact.phone)),
        limit(1),
      ),
    );
    if (duplicateSnap.docs.length > 0) {
      throw new DuplicateContactError();
    }

    const keyedRef = contactDoc(
      userId,
      `${CONTACT_ID_PREFIX}${formatIndianPhone(contact.phone).replace(/\D/g, '')}`,
    );
    // The query found no document with this number, so a document already at
    // the keyed id belongs to a contact whose phone was edited since — fall
    // back to a generated id rather than overwrite it.
    const occupied = await getDoc(keyedRef);
    if (occupied.exists()) {
      const created = await addDoc(contactsCollection(userId), contact);
      return { id: created.id, ...contact };
    }

    await setDoc(keyedRef, contact);
    return { id: keyedRef.id, ...contact };
  } catch (error) {
    if (error instanceof DuplicateContactError) throw error;
    console.error('addEmergencyContact failed:', error);
    throw error;
  }
}

/** Applies a partial update to a custom emergency contact. */
export async function updateEmergencyContact(
  userId: string,
  contactId: string,
  updates: Partial<EmergencyContact>,
): Promise<void> {
  try {
    await updateDoc(contactDoc(userId, contactId), updates);
  } catch (error) {
    console.error('updateEmergencyContact failed:', error);
    throw error;
  }
}

/**
 * Deletes a custom emergency contact. The caller is responsible for refusing
 * predefined helplines — the service has no `isPredefined` context here.
 */
export async function deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
  try {
    await deleteDoc(contactDoc(userId, contactId));
  } catch (error) {
    console.error('deleteEmergencyContact failed:', error);
    throw error;
  }
}

/** Rewrites every contact's `order` to match its position in the array. */
export async function reorderEmergencyContacts(
  userId: string,
  contacts: EmergencyContact[],
): Promise<void> {
  try {
    const batch = writeBatch(firestore);
    contacts.forEach((contact, index) => {
      batch.update(contactDoc(userId, contact.id), { order: index });
    });
    await batch.commit();
  } catch (error) {
    console.error('reorderEmergencyContacts failed:', error);
    throw error;
  }
}
