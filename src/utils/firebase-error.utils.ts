/**
 * Maps a raw Firebase error code to an i18n key so no service ever lets a raw
 * Firebase/English error string reach a screen — see CLAUDE.md absolute rule 4.
 */
const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/invalid-phone-number': 'auth.phoneInvalid',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/invalid-verification-code': 'auth.otpInvalid',
  'auth/code-expired': 'auth.otpExpired',
  'auth/user-disabled': 'errors.sessionExpired',
  'auth/network-request-failed': 'errors.networkError',
  'firestore/unavailable': 'errors.networkError',
  'firestore/deadline-exceeded': 'errors.networkError',
  'firestore/permission-denied': 'errors.permissionRequired',
  'firestore/not-found': 'errors.generic',
  'firestore/resource-exhausted': 'errors.generic',
  'firestore/cancelled': 'errors.generic',
  'storage/unauthorized': 'errors.permissionRequired',
  'storage/canceled': 'errors.generic',
  'storage/unknown': 'errors.uploadFailed',
  'storage/quota-exceeded': 'errors.uploadFailed',
  'storage/retry-limit-exceeded': 'errors.networkError',
};

/** Fallback i18n key for any error not in the map above, or a non-`Error` throw. */
const GENERIC_ERROR_KEY = 'errors.generic';

/** Reads a Firebase error's `code` field without ever widening to `any`. */
function firebaseErrorCode(error: Error): string {
  const code = (error as unknown as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

/** Maps any thrown value to an i18n key safe to show the user. */
export function mapFirebaseError(error: unknown): string {
  if (error instanceof Error) {
    return FIREBASE_ERROR_MAP[firebaseErrorCode(error)] ?? GENERIC_ERROR_KEY;
  }
  return GENERIC_ERROR_KEY;
}
