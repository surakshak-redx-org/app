/**
 * Every AsyncStorage key the app reads or writes. Centralised so a rename can
 * never drift between the writer and the reader (absolute rule 6).
 */
export const STORAGE_KEYS = {
  /** `'true'` once the user has finished the onboarding wizard. */
  ONBOARDING_COMPLETE: 'surakshak_onboarding_complete',
  /** `'false'` disables shake-to-SOS; anything else (or absent) means enabled. */
  SHAKE_ENABLED: 'surakshak_shake_enabled',
  /** `'false'` disables the low-battery alert; absent means enabled. */
  LOW_BATTERY_ENABLED: 'surakshak_low_battery_enabled',
  /** `JSON.stringify`'d `SMSAlertRecord[]`, newest first, capped at 50. */
  SMS_HISTORY: 'surakshak_sms_history',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Canonical truthy value written for boolean-style flags. */
export const STORAGE_FLAG_ON = 'true';

/** A boolean flag counts as disabled only when it was explicitly set to this. */
export const STORAGE_FLAG_OFF = 'false';
