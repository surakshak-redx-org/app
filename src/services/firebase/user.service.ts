import type { CreateUserInput, EmergencyContact, User } from '@/types/user.types';

/**
 * Reads a user profile document.
 * @phase Phase 2 — Auth & Onboarding
 */
export function getUserProfile(_userId: string): Promise<User | null> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Creates the profile document for a newly registered user.
 * @phase Phase 2 — Auth & Onboarding
 */
export function createUserProfile(_userId: string, _input: CreateUserInput): Promise<User> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Applies a partial update to a user profile.
 * @phase Phase 2 — Auth & Onboarding
 */
export function updateUserProfile(_userId: string, _updates: Partial<User>): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Uploads a profile photo to Storage and returns its download URL.
 * @phase Phase 2 — Auth & Onboarding
 */
export function uploadProfilePhoto(_userId: string, _localUri: string): Promise<string> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
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
