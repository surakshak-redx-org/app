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
  COMMUNITY_POST_MAX_LENGTH: 500,
  COMMUNITY_PAGE_SIZE: 20,
  COMMUNITY_FEED_LIMIT: 50,
  COMMUNITY_IMAGE_QUALITY: 0.7,
  SAFE_JOURNEY_CHECK_INTERVAL_MINUTES: 5,
  SAFE_CHECKIN_MISSED_COUNT_BEFORE_ALERT: 2,
  MAX_EVIDENCE_RECORDING_MINUTES: 30,
  MAX_COMMUNITY_IMAGE_MB: 5,
  UNSAFE_AREA_SEARCH_RADIUS_KM: 50,
  CACHE_EXPIRY_HOURS: 24,
  /** Newest-first cap on the Information Hub news feed. */
  NEWS_FEED_LIMIT: 30,
  /** Tags shown on a law list card before the rest are hidden. */
  LAW_CARD_TAG_PREVIEW_COUNT: 3,
  LIVE_LOCATION_DISTANCE_INTERVAL_METERS: 10,
  SAFE_JOURNEY_ETA_MIN_MINUTES: 5,
  SAFE_JOURNEY_ETA_MAX_MINUTES: 480,
  SAFE_JOURNEY_ETA_DEFAULT_MINUTES: 30,
  /** Countdown turns red once the journey has this many seconds or fewer left. */
  SAFE_JOURNEY_ALERT_WARN_SECONDS: 300,
  UNSAFE_AREA_DEFAULT_RADIUS_METERS: 200,
  NEARBY_HELP_SEARCH_RADIUS_METERS: 5000,
  NEARBY_HELP_MAX_RESULTS: 20,
  /** Bias radius for destination autocomplete around the user's location. */
  PLACE_AUTOCOMPLETE_BIAS_RADIUS_METERS: 50000,
  /** Don't hit the autocomplete API until the query is at least this long. */
  PLACE_AUTOCOMPLETE_MIN_CHARS: 3,
  /** Debounce between keystrokes and the autocomplete request. */
  PLACE_AUTOCOMPLETE_DEBOUNCE_MS: 300,
  /** Region span used when centring the map on a fresh fix. */
  MAP_DEFAULT_LATITUDE_DELTA: 0.02,
  MAP_DEFAULT_LONGITUDE_DELTA: 0.02,
  /** Mumbai — where the map opens before a location fix is available. */
  MAP_FALLBACK_LATITUDE: 19.076,
  MAP_FALLBACK_LONGITUDE: 72.8777,
} as const;

/** Live-location share durations (hours) offered on the Live Location screen. */
export const LIVE_LOCATION_DURATION_OPTIONS_HOURS = [1, 2, 4, 8] as const;

/** ETA presets (minutes) offered on the Safe Journey form. */
export const SAFE_JOURNEY_ETA_PRESETS_MINUTES = [15, 30, 60, 120] as const;

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

/**
 * Sentinel for the "show everything" chip in the Information Hub category
 * filters. A string, so it lives outside the numeric `APP_CONFIG` object; its
 * visible label comes from `t('info.allCategories')`.
 */
export const ALL_CATEGORIES = 'all';

/**
 * 4:3 crop the picker applies to an attached community image. Kept out of
 * `APP_CONFIG` because that object is asserted to be entirely numeric.
 */
export const COMMUNITY_IMAGE_ASPECT: [number, number] = [4, 3];
