import { Linking, Platform } from 'react-native';
import { placeCallDirectly } from 'surakshak-native';

const INDIA_COUNTRY_CODE = '+91';
const INDIAN_MOBILE_LENGTH = 10;
const VISIBLE_DIGITS_WHEN_MASKED = 4;

/** Government helplines are 3–5 digit short codes and must be dialled verbatim. */
const SHORT_CODE_PATTERN = /^\d{3,5}$/;

/** Single-digit repeated pattern (e.g. 9999999999, 8888888888) used for dummy test numbers. */
const REPEATED_DIGIT_PATTERN = /^([6-9])\1{9}$/;

/** Strips all characters except digits and an optional leading '+'. */
export function sanitizePhoneInput(input: string): string {
  const trimmed = input.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = input.replace(/\D/g, '');
  return hasLeadingPlus ? `+${digits}` : digits;
}

/** Returns true if the phone string is a short government emergency helpline (3-5 digits). */
export function isEmergencyShortcode(phone: string): boolean {
  return SHORT_CODE_PATTERN.test(phone.replace(/\D/g, ''));
}

/** Strips everything non-numeric and any leading country code / trunk zero. */
export function toNationalDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.length > INDIAN_MOBILE_LENGTH && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length > INDIAN_MOBILE_LENGTH && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/** Normalises any user-entered form to E.164, e.g. `+919876543210`. */
export function formatIndianPhone(phone: string): string {
  return `${INDIA_COUNTRY_CODE}${toNationalDigits(phone)}`;
}

/**
 * Indian mobile numbers are 10 digits and always begin 6, 7, 8 or 9.
 * Rejects non-dialable characters (letters, emojis) and dummy repeated digits.
 */
export function validateIndianPhone(phone: string): boolean {
  // Reject raw strings with emojis, alphabets, or illegal characters
  if (/[^\d+\s()-]/.test(phone)) {
    return false;
  }

  const national = toNationalDigits(phone);
  if (!/^[6-9]\d{9}$/.test(national)) {
    return false;
  }

  // Reject dummy numbers where all 10 digits are identical (e.g. 9999999999)
  if (REPEATED_DIGIT_PATTERN.test(national)) {
    return false;
  }

  return true;
}

/** Hides all but the last four digits, e.g. `+91XXXXXX3210`. */
export function maskPhone(phone: string): string {
  const national = toNationalDigits(phone);

  if (national.length <= VISIBLE_DIGITS_WHEN_MASKED) {
    return `${INDIA_COUNTRY_CODE}${national}`;
  }

  const visible = national.slice(-VISIBLE_DIGITS_WHEN_MASKED);
  const masked = 'X'.repeat(national.length - VISIBLE_DIGITS_WHEN_MASKED);

  return `${INDIA_COUNTRY_CODE}${masked}${visible}`;
}

/**
 * Places an emergency call. On Android with `CALL_PHONE` granted, `surakshak-native`
 * places the call directly via `Intent.ACTION_CALL` — no dialer, no tap. If
 * that fails for any reason (permission revoked, OEM restriction, etc.) it
 * falls back to opening the dialer pre-filled, same as iOS. On iOS the dialer
 * always opens pre-filled and the user taps once to call — an Apple OS
 * restriction with no direct-call API, not fixable from here. Short codes
 * such as `112` / `1091` are dialled as-is; 10-digit numbers are normalised
 * to E.164.
 */
export async function placeCall(phone: string): Promise<void> {
  try {
    const isShortcode = isEmergencyShortcode(phone);
    const target = isShortcode ? phone.replace(/\D/g, '') : formatIndianPhone(phone);

    // Emergency shortcodes (112, 100, etc.) are restricted by Android OS from non-system
    // ACTION_CALL intents (requires CALL_PRIVILEGED). Route shortcodes directly to dialer.
    if (Platform.OS === 'android' && !isShortcode) {
      try {
        await placeCallDirectly(target);
        return;
      } catch (directCallError) {
        console.warn('placeCallDirectly failed, falling back to dialer:', directCallError);
      }
    }

    const canOpen = await Linking.canOpenURL(`tel:${target}`);
    if (!canOpen && Platform.OS === 'android') {
      console.warn('Linking cannot open tel: URL, telephony may be missing');
    }

    await Linking.openURL(`tel:${target}`);
  } catch (error) {
    console.error('placeCall failed:', error);
    throw error;
  }
}
