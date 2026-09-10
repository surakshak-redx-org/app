export const APP_CONFIG = {
  LIVE_LOCATION_DEFAULT_HOURS: 1,
  LIVE_LOCATION_MAX_HOURS: 8,
  LIVE_LOCATION_UPDATE_INTERVAL_SECONDS: 30,
  SOS_COUNTDOWN_SECONDS: 5,
  SOS_TAP_COUNT: 3,
  SOS_TAP_WINDOW_MS: 1500,
  SHAKE_THRESHOLD: 2.5,
  SHAKE_COUNT_REQUIRED: 3,
  SHAKE_WINDOW_MS: 2000,
  SHAKE_SAMPLE_INTERVAL_MS: 100,
  LOW_BATTERY_THRESHOLD_PERCENT: 20,
  FAKE_CALL_DEFAULT_DELAY_SECONDS: 15,
  FAKE_CALL_RING_SECONDS: 30,
  COMMUNITY_REPORT_HIDE_THRESHOLD: 3,
  SAFE_JOURNEY_CHECK_INTERVAL_MINUTES: 5,
  SAFE_CHECKIN_MISSED_COUNT_BEFORE_ALERT: 2,
  MAX_EVIDENCE_RECORDING_MINUTES: 30,
  MAX_COMMUNITY_IMAGE_MB: 5,
  UNSAFE_AREA_SEARCH_RADIUS_KM: 50,
  CACHE_EXPIRY_HOURS: 24,
} as const;

/** Base URL for the shareable location links sent in every SOS / journey SMS. */
export const GOOGLE_MAPS_PLACE_URL = 'https://www.google.com/maps/place';

/**
 * Delay presets (seconds) offered by the fake-call scheduler. `0` means the
 * call rings immediately. Kept out of `APP_CONFIG` because that object is
 * asserted to be entirely numeric.
 */
export const FAKE_CALL_DELAY_OPTIONS_SECONDS = [0, 60, 300] as const;

/** Written into an SMS alert record when a location fix could not be obtained. */
export const LOCATION_UNAVAILABLE = 'Location unavailable';

/** Newest-first cap on the locally persisted SMS alert history. */
export const SMS_HISTORY_LIMIT = 50;
