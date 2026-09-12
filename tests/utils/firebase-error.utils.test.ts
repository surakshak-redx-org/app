import { mapFirebaseError } from '@/utils/firebase-error.utils';

function firebaseError(code: string): Error {
  const error = new Error(code);
  (error as Error & { code: string }).code = code;
  return error;
}

describe('mapFirebaseError', () => {
  it('maps auth/invalid-phone-number to auth.phoneInvalid', () => {
    expect(mapFirebaseError(firebaseError('auth/invalid-phone-number'))).toBe('auth.phoneInvalid');
  });

  it('maps firestore/unavailable to errors.networkError', () => {
    expect(mapFirebaseError(firebaseError('firestore/unavailable'))).toBe('errors.networkError');
  });

  it('maps storage/retry-limit-exceeded to errors.networkError', () => {
    expect(mapFirebaseError(firebaseError('storage/retry-limit-exceeded'))).toBe(
      'errors.networkError',
    );
  });

  it('falls back to errors.generic for an unknown code', () => {
    expect(mapFirebaseError(firebaseError('auth/some-new-code'))).toBe('errors.generic');
  });

  it('falls back to errors.generic for a non-Error input', () => {
    expect(mapFirebaseError('just a string')).toBe('errors.generic');
  });

  it('falls back to errors.generic for null', () => {
    expect(mapFirebaseError(null)).toBe('errors.generic');
  });
});
