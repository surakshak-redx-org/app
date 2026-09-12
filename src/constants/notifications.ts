/** Android notification channel ids used across the app. */
export const NOTIFICATION_CHANNEL_IDS = {
  /** Low-importance channel for the shake-detection "still protecting you" notice. */
  FOREGROUND: 'surakshak_foreground',
} as const;

/** Stable identifiers for scheduled/dismissed local notifications. */
export const NOTIFICATION_IDS = {
  /** Shown while shake-to-SOS is armed; dismissed when it's turned off. */
  SHAKE_DETECTION_ACTIVE: 'surakshak_shake_detection_active',
} as const;
