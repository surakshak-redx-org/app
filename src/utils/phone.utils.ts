import { Linking } from 'react-native';

const INDIA_COUNTRY_CODE = '+91';
const INDIAN_MOBILE_LENGTH = 10;
const VISIBLE_DIGITS_WHEN_MASKED = 4;

/** Government helplines are 3–5 digit short codes and must be dialled verbatim. */
const SHORT_CODE_PATTERN = /^\d{3,5}$/;

/** Strips everything non-numeric and any leading country code / trunk zero. */
function toNationalDigits(phone: string): string {
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

/** Indian mobile numbers are 10 digits and always begin 6, 7, 8 or 9. */
export function validateIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(toNationalDigits(phone));
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
 * Opens the phone dialer for a number. On Android with `CALL_PHONE` granted the
 * OS places the call directly; on iOS the dialer opens with the number filled
 * in and the user taps once to call (an Apple restriction). Short codes such as
 * `112` / `1091` are dialled as-is; 10-digit numbers are normalised to E.164.
 */
export async function placeCall(phone: string): Promise<void> {
  try {
    const digits = phone.replace(/\D/g, '');
    const target = SHORT_CODE_PATTERN.test(digits) ? digits : formatIndianPhone(phone);
    await Linking.openURL(`tel:${target}`);
  } catch (error) {
    console.error('placeCall failed:', error);
    throw error;
  }
}
