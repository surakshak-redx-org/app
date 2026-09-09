import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from '@react-native-firebase/auth';

import { auth } from '@/config/firebase';

/**
 * Subscribes to Firebase auth state. Implemented in Phase 1 because the root
 * layout needs it to decide between the auth stack and the tab stack, and
 * absolute rule 13 forbids calling Firebase directly from a screen.
 *
 * @returns an unsubscribe function — always call it on unmount.
 */
export function subscribeToAuthChanges(onChange: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, onChange);
}

/**
 * Signs the current user out.
 * @phase Phase 2 — Auth & Onboarding (already usable)
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('signOutUser failed:', error);
    throw error;
  }
}

/**
 * Sends an OTP to an Indian mobile number and returns the verification id.
 * @phase Phase 2 — Auth & Onboarding
 */
export function sendOtp(_phoneNumber: string): Promise<string> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Confirms an OTP code against a verification id and signs the user in.
 * @phase Phase 2 — Auth & Onboarding
 */
export function confirmOtp(_verificationId: string, _code: string): Promise<FirebaseUser> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Signs in anonymously for guest mode.
 * @phase Phase 2 — Auth & Onboarding
 */
export function signInAsGuest(): Promise<FirebaseUser> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}

/**
 * Permanently deletes the signed-in user's account and profile.
 * @phase Phase 2 — Auth & Onboarding
 */
export function deleteAccount(): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 2'));
}
