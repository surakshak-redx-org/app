import type { PermissionKey } from '@/utils/permissions.utils';

/** Digits in the OTP Firebase sends for phone sign-in. */
export const OTP_LENGTH = 6;

/** Seconds the user must wait before "Resend OTP" becomes available. */
export const OTP_RESEND_SECONDS = 60;

/** Steps in the onboarding wizard: language → permissions → profile. */
export const ONBOARDING_STEP_COUNT = 3;

/** An Indian mobile number, without the +91 country code. */
export const PHONE_DIGITS = 10;

export const NAME_MIN = 2;
export const NAME_MAX = 50;
export const CITY_MIN = 2;
export const CITY_MAX = 50;

/** Square crop for the profile photo. */
export const PROFILE_PHOTO_ASPECT: [number, number] = [1, 1];

/** JPEG quality (0–1) the image picker compresses the profile photo to. */
export const PROFILE_PHOTO_QUALITY = 0.8;

/**
 * Permissions the user cannot skip in onboarding — the app cannot run its core
 * SOS flow without them.
 */
export const REQUIRED_PERMISSIONS: readonly PermissionKey[] = ['location', 'contacts'] as const;
