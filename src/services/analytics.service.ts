import { identify, resetAnalytics, track } from '@/config/mixpanel';
import type { CommunityTab, PostType } from '@/types/community.types';
import type { SMSAlertType, SOSTriggerMethod } from '@/types/emergency.types';

/**
 * Named events so screens never pass raw strings — absolute rule 6.
 */
export const ANALYTICS_EVENTS = {
  SOS_TRIGGERED: 'sos_triggered',
  SOS_CANCELLED: 'sos_cancelled',
  SMS_ALERT_SENT: 'sms_alert_sent',
  SIREN_TOGGLED: 'siren_toggled',
  FAKE_CALL_SCHEDULED: 'fake_call_scheduled',
  FAKE_CALL_TRIGGERED: 'fake_call_triggered',
  EMERGENCY_CALL_PLACED: 'emergency_call_placed',
  EMERGENCY_CONTACT_ADDED: 'emergency_contact_added',
  EMERGENCY_CONTACT_UPDATED: 'emergency_contact_updated',
  EMERGENCY_CONTACT_DELETED: 'emergency_contact_deleted',
  LOW_BATTERY_ALERT_SENT: 'low_battery_alert_sent',
  LIVE_LOCATION_STARTED: 'live_location_started',
  LIVE_LOCATION_STOPPED: 'live_location_stopped',
  LIVE_LOCATION_EXTENDED: 'live_location_extended',
  SAFE_JOURNEY_STARTED: 'safe_journey_started',
  SAFE_JOURNEY_ARRIVED: 'safe_journey_arrived',
  SAFE_JOURNEY_ALERT_SENT: 'safe_journey_alert_sent',
  COMMUNITY_POST_CREATED: 'community_post_created',
  COMMUNITY_POST_REPORTED: 'community_post_reported',
  COMMUNITY_HELP_REQUESTED: 'community_help_requested',
  COMMUNITY_TAB_SWITCHED: 'community_tab_switched',
  COMMUNITY_IMAGE_SHARED: 'community_image_shared',
  COMMUNITY_LOCATION_SHARED: 'community_location_shared',
  UNSAFE_AREA_REPORTED: 'unsafe_area_reported',
  UNSAFE_AREA_UPVOTED: 'unsafe_area_upvoted',
  UNSAFE_AREA_DOWNVOTED: 'unsafe_area_downvoted',
  NEARBY_HELP_VIEWED: 'nearby_help_viewed',
  NEARBY_HELP_CALLED: 'nearby_help_called',
  NEARBY_HELP_DIRECTIONS: 'nearby_help_directions',
  INCIDENT_REPORTED: 'incident_reported',
  EVIDENCE_RECORDING_STARTED: 'evidence_recording_started',
  EVIDENCE_RECORDING_UPLOADED: 'evidence_recording_uploaded',
  SUSPICIOUS_FOLLOW_DETECTED: 'suspicious_follow_detected',
  SUSPICIOUS_FOLLOW_SOS_TRIGGERED: 'suspicious_follow_sos_triggered',
  DISGUISE_MODE_ENABLED: 'disguise_mode_enabled',
  DISGUISE_MODE_UNLOCKED: 'disguise_mode_unlocked',
  SAFE_CHECKIN_STARTED: 'safe_checkin_started',
  SAFE_CHECKIN_MISSED: 'safe_checkin_missed',
  SAFE_CHECKIN_ALERT_SENT: 'safe_checkin_alert_sent',
  LAW_VIEWED: 'law_viewed',
  FAQ_VIEWED: 'faq_viewed',
  TIPS_VIEWED: 'tips_viewed',
  NEWS_VIEWED: 'news_viewed',
  INFO_SECTION_OPENED: 'info_section_opened',
  LANGUAGE_CHANGED: 'language_changed',
  LANGUAGE_AUTO_DETECTED: 'language_auto_detected',
  TRANSLATION_COVERAGE: 'translation_coverage',
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

/* ------------------------------------------------------------------ *
 * Typed helpers — call these from features so an event name and its
 * payload shape can never drift apart.
 * ------------------------------------------------------------------ */

export function trackSosTriggered(method: SOSTriggerMethod): void {
  trackEvent(ANALYTICS_EVENTS.SOS_TRIGGERED, { method });
}

export function trackSosCancelled(method: SOSTriggerMethod | null): void {
  trackEvent(ANALYTICS_EVENTS.SOS_CANCELLED, { method });
}

export function trackSmsAlertSent(type: SMSAlertType, sent: number, failed: number): void {
  trackEvent(ANALYTICS_EVENTS.SMS_ALERT_SENT, {
    alert_type: type,
    contacts_count: sent,
    failed_count: failed,
  });
}

export function trackSirenToggled(active: boolean): void {
  trackEvent(ANALYTICS_EVENTS.SIREN_TOGGLED, { active });
}

export function trackFakeCallScheduled(delaySeconds: number): void {
  trackEvent(ANALYTICS_EVENTS.FAKE_CALL_SCHEDULED, { delay_seconds: delaySeconds });
}

export function trackFakeCallTriggered(): void {
  trackEvent(ANALYTICS_EVENTS.FAKE_CALL_TRIGGERED, {});
}

export function trackEmergencyCallPlaced(target: 'predefined' | 'custom'): void {
  trackEvent(ANALYTICS_EVENTS.EMERGENCY_CALL_PLACED, { number_type: target });
}

export function trackEmergencyContactChange(action: 'added' | 'updated' | 'deleted'): void {
  const event =
    action === 'added'
      ? ANALYTICS_EVENTS.EMERGENCY_CONTACT_ADDED
      : action === 'updated'
        ? ANALYTICS_EVENTS.EMERGENCY_CONTACT_UPDATED
        : ANALYTICS_EVENTS.EMERGENCY_CONTACT_DELETED;
  trackEvent(event, {});
}

export function trackLowBatteryAlertSent(batteryLevel: number): void {
  trackEvent(ANALYTICS_EVENTS.LOW_BATTERY_ALERT_SENT, { battery_level: batteryLevel });
}

/* ------------------------- location & maps ------------------------- */

export function trackLiveLocationStarted(contactsCount: number, durationHours: number): void {
  trackEvent(ANALYTICS_EVENTS.LIVE_LOCATION_STARTED, {
    contacts_count: contactsCount,
    duration_hours: durationHours,
  });
}

export function trackLiveLocationStopped(): void {
  trackEvent(ANALYTICS_EVENTS.LIVE_LOCATION_STOPPED, {});
}

export function trackLiveLocationExtended(hours: number): void {
  trackEvent(ANALYTICS_EVENTS.LIVE_LOCATION_EXTENDED, { hours });
}

export function trackSafeJourneyStarted(etaMinutes: number, contactsCount: number): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_JOURNEY_STARTED, {
    eta_minutes: etaMinutes,
    contacts_count: contactsCount,
  });
}

export function trackSafeJourneyArrived(): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_JOURNEY_ARRIVED, {});
}

export function trackSafeJourneyAlertSent(): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_JOURNEY_ALERT_SENT, {});
}

export function trackUnsafeAreaReported(category: string): void {
  trackEvent(ANALYTICS_EVENTS.UNSAFE_AREA_REPORTED, { category });
}

export function trackUnsafeAreaVoted(vote: 'up' | 'down'): void {
  trackEvent(
    vote === 'up' ? ANALYTICS_EVENTS.UNSAFE_AREA_UPVOTED : ANALYTICS_EVENTS.UNSAFE_AREA_DOWNVOTED,
    {},
  );
}

export function trackNearbyHelpViewed(category: string): void {
  trackEvent(ANALYTICS_EVENTS.NEARBY_HELP_VIEWED, { category });
}

export function trackNearbyHelpCalled(category: string): void {
  trackEvent(ANALYTICS_EVENTS.NEARBY_HELP_CALLED, { category });
}

export function trackNearbyHelpDirections(category: string): void {
  trackEvent(ANALYTICS_EVENTS.NEARBY_HELP_DIRECTIONS, { category });
}

/* --------------------------- community ---------------------------- */

export function trackCommunityPostCreated(type: PostType, isAnonymous: boolean): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_POST_CREATED, { type, is_anonymous: isAnonymous });
}

export function trackCommunityPostReported(): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_POST_REPORTED, {});
}

export function trackCommunityHelpRequested(): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_HELP_REQUESTED, {});
}

export function trackCommunityTabSwitched(tab: CommunityTab): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_TAB_SWITCHED, { tab });
}

export function trackCommunityImageShared(): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_IMAGE_SHARED, {});
}

export function trackCommunityLocationShared(): void {
  trackEvent(ANALYTICS_EVENTS.COMMUNITY_LOCATION_SHARED, {});
}

/* ------------------------- information hub ------------------------- */

export type InfoSection = 'laws' | 'faq' | 'tips' | 'news';

export function trackInfoSectionOpened(section: InfoSection): void {
  trackEvent(ANALYTICS_EVENTS.INFO_SECTION_OPENED, { section });
}

export function trackLawViewed(lawId: string, category: string): void {
  trackEvent(ANALYTICS_EVENTS.LAW_VIEWED, { law_id: lawId, category });
}

export function trackFaqViewed(faqId: string, category: string): void {
  trackEvent(ANALYTICS_EVENTS.FAQ_VIEWED, { faq_id: faqId, category });
}

export function trackTipsViewed(category: string): void {
  trackEvent(ANALYTICS_EVENTS.TIPS_VIEWED, { category });
}

export function trackNewsViewed(newsId: string, category: string): void {
  trackEvent(ANALYTICS_EVENTS.NEWS_VIEWED, { news_id: newsId, category });
}

/* ------------------------- advanced safety -------------------------- */

export function trackIncidentReportSubmitted(photoCount: number): void {
  trackEvent(ANALYTICS_EVENTS.INCIDENT_REPORTED, { photo_count: photoCount });
}

export function trackEvidenceRecordingStarted(): void {
  trackEvent(ANALYTICS_EVENTS.EVIDENCE_RECORDING_STARTED, {});
}

export function trackEvidenceRecordingUploaded(durationSeconds: number): void {
  trackEvent(ANALYTICS_EVENTS.EVIDENCE_RECORDING_UPLOADED, {
    duration_seconds: durationSeconds,
  });
}

export function trackSuspiciousFollowDetected(): void {
  trackEvent(ANALYTICS_EVENTS.SUSPICIOUS_FOLLOW_DETECTED, {});
}

export function trackSuspiciousFollowSosTriggered(): void {
  trackEvent(ANALYTICS_EVENTS.SUSPICIOUS_FOLLOW_SOS_TRIGGERED, {});
}

export function trackDisguiseModeEnabled(): void {
  trackEvent(ANALYTICS_EVENTS.DISGUISE_MODE_ENABLED, {});
}

export function trackDisguiseModeUnlocked(): void {
  trackEvent(ANALYTICS_EVENTS.DISGUISE_MODE_UNLOCKED, {});
}

export function trackSafeCheckinStarted(intervalMinutes: number): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_CHECKIN_STARTED, { interval_minutes: intervalMinutes });
}

export function trackSafeCheckinMissed(): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_CHECKIN_MISSED, {});
}

export function trackSafeCheckinAlertSent(): void {
  trackEvent(ANALYTICS_EVENTS.SAFE_CHECKIN_ALERT_SENT, {});
}

/* --------------------------- localization --------------------------- */

/** Called by the translation-coverage test/tooling, not from a screen. */
export function trackTranslationValidation(language: string, missingCount: number): void {
  trackEvent(ANALYTICS_EVENTS.TRANSLATION_COVERAGE, { language, missing_count: missingCount });
}

export function trackLanguageAutoDetected(detectedLocale: string, selectedLanguage: string): void {
  trackEvent(ANALYTICS_EVENTS.LANGUAGE_AUTO_DETECTED, {
    detected_locale: detectedLocale,
    selected_language: selectedLanguage,
  });
}
