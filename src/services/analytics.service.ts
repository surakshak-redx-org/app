import { identify, resetAnalytics, track } from '@/config/mixpanel';

/**
 * Named events so screens never pass raw strings — absolute rule 6.
 */
export const ANALYTICS_EVENTS = {
  SOS_TRIGGERED: 'sos_triggered',
  SOS_CANCELLED: 'sos_cancelled',
  LIVE_LOCATION_STARTED: 'live_location_started',
  SAFE_JOURNEY_STARTED: 'safe_journey_started',
  COMMUNITY_POST_CREATED: 'community_post_created',
  UNSAFE_AREA_REPORTED: 'unsafe_area_reported',
  INCIDENT_REPORTED: 'incident_reported',
  LANGUAGE_CHANGED: 'language_changed',
  OTP_REQUESTED: 'otp_requested',
  OTP_VERIFIED: 'otp_verified',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  GUEST_SESSION_STARTED: 'guest_session_started',
  SIGN_OUT: 'sign_out',
  ACCOUNT_DELETED: 'account_deleted',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** No-ops when APP_ENV is dev — see `src/config/mixpanel.ts`. */
export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  track(event, properties);
}

export function identifyUser(userId: string): void {
  identify(userId);
}

export function resetUser(): void {
  resetAnalytics();
}
