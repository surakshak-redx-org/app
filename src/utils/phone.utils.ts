const INDIA_COUNTRY_CODE = '+91';
const INDIAN_MOBILE_LENGTH = 10;
const VISIBLE_DIGITS_WHEN_MASKED = 4;

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
