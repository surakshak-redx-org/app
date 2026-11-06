import { setPeopleProperties, setSuperProperties, track } from '@/config/mixpanel';
import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetUser,
  setAnalyticsSuperProperties,
  setAnalyticsUserProperties,
  trackLiveLocationExpired,
  trackOtpRequested,
  trackOtpRequestFailed,
  trackOtpVerified,
  trackOtpVerifyFailed,
  trackPermissionResult,
  trackSafeCheckinConfirmed,
  trackSafeJourneyCancelled,
  trackScreenViewed,
  trackSettingChanged,
  trackSosOutcome,
  trackEmergencyCallPlaced,
  trackEmergencyContactChange,
  trackEvent,
  trackFakeCallScheduled,
  trackLiveLocationExtended,
  trackLiveLocationStarted,
  trackLiveLocationStopped,
  trackLowBatteryAlertSent,
  trackNearbyHelpCalled,
  trackNearbyHelpDirections,
  trackNearbyHelpViewed,
  trackSafeJourneyAlertSent,
  trackSafeJourneyArrived,
  trackSafeJourneyStarted,
  trackSirenToggled,
  trackSmsAlertSent,
  trackCommunityHelpRequested,
  trackCommunityImageShared,
  trackCommunityLocationShared,
  trackCommunityPostCreated,
  trackCommunityPostReported,
  trackCommunityTabSwitched,
  trackFaqViewed,
  trackInfoSectionOpened,
  trackLawViewed,
  trackNewsViewed,
  trackSosCancelled,
  trackSosTriggered,
  trackTipsViewed,
  trackUnsafeAreaReported,
  trackUnsafeAreaVoted,
} from '@/services/analytics.service';

jest.mock('@/config/mixpanel', () => ({
  track: jest.fn(),
  identify: jest.fn(),
  resetAnalytics: jest.fn(),
  setSuperProperties: jest.fn(),
  setPeopleProperties: jest.fn(),
}));

describe('analytics.service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards named events to MixPanel', () => {
    trackEvent(ANALYTICS_EVENTS.SOS_TRIGGERED, { method: 'button' });
    expect(track).toHaveBeenCalledWith('sos_triggered', { method: 'button' });
  });

  it('exposes every event as a snake_case constant', () => {
    for (const value of Object.values(ANALYTICS_EVENTS)) {
      expect(value).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('exposes identify and reset without throwing', () => {
    expect(() => {
      identifyUser('user-1');
      resetUser();
    }).not.toThrow();
  });

  it('maps the typed SOS helpers to their events and payloads', () => {
    trackSosTriggered('shake');
    expect(track).toHaveBeenLastCalledWith('sos_triggered', { method: 'shake' });

    trackSosCancelled('button');
    expect(track).toHaveBeenLastCalledWith('sos_cancelled', { method: 'button' });
  });

  it('maps the SMS / siren / fake-call / call / battery helpers', () => {
    trackSmsAlertSent('sos', 2, 1);
    expect(track).toHaveBeenLastCalledWith('sms_alert_sent', {
      alert_type: 'sos',
      contacts_count: 2,
      failed_count: 1,
    });

    trackSirenToggled(true);
    expect(track).toHaveBeenLastCalledWith('siren_toggled', { active: true });

    trackFakeCallScheduled(60);
    expect(track).toHaveBeenLastCalledWith('fake_call_scheduled', { delay_seconds: 60 });

    trackEmergencyCallPlaced('predefined');
    expect(track).toHaveBeenLastCalledWith('emergency_call_placed', { number_type: 'predefined' });

    trackLowBatteryAlertSent(18);
    expect(track).toHaveBeenLastCalledWith('low_battery_alert_sent', { battery_level: 18 });
  });

  it('maps the location & maps helpers to their events and payloads', () => {
    trackLiveLocationStarted(3, 4);
    expect(track).toHaveBeenLastCalledWith('live_location_started', {
      contacts_count: 3,
      duration_hours: 4,
    });

    trackLiveLocationStopped();
    expect(track).toHaveBeenLastCalledWith('live_location_stopped', {});

    trackLiveLocationExtended(1);
    expect(track).toHaveBeenLastCalledWith('live_location_extended', { hours: 1 });

    trackSafeJourneyStarted(30, 2);
    expect(track).toHaveBeenLastCalledWith('safe_journey_started', {
      eta_minutes: 30,
      contacts_count: 2,
    });

    trackSafeJourneyArrived();
    expect(track).toHaveBeenLastCalledWith('safe_journey_arrived', {});

    trackSafeJourneyAlertSent();
    expect(track).toHaveBeenLastCalledWith('safe_journey_alert_sent', {});

    trackUnsafeAreaReported('poorly_lit');
    expect(track).toHaveBeenLastCalledWith('unsafe_area_reported', { category: 'poorly_lit' });

    trackUnsafeAreaVoted('up');
    expect(track).toHaveBeenLastCalledWith('unsafe_area_upvoted', {});
    trackUnsafeAreaVoted('down');
    expect(track).toHaveBeenLastCalledWith('unsafe_area_downvoted', {});

    trackNearbyHelpViewed('hospital');
    expect(track).toHaveBeenLastCalledWith('nearby_help_viewed', { category: 'hospital' });
    trackNearbyHelpCalled('police');
    expect(track).toHaveBeenLastCalledWith('nearby_help_called', { category: 'police' });
    trackNearbyHelpDirections('pharmacy');
    expect(track).toHaveBeenLastCalledWith('nearby_help_directions', { category: 'pharmacy' });
  });

  it('maps the community helpers to their events and payloads', () => {
    trackCommunityPostCreated('image', true);
    expect(track).toHaveBeenLastCalledWith('community_post_created', {
      type: 'image',
      is_anonymous: true,
    });

    trackCommunityPostReported();
    expect(track).toHaveBeenLastCalledWith('community_post_reported', {});

    trackCommunityHelpRequested();
    expect(track).toHaveBeenLastCalledWith('community_help_requested', {});

    trackCommunityTabSwitched('all_india');
    expect(track).toHaveBeenLastCalledWith('community_tab_switched', { tab: 'all_india' });

    trackCommunityImageShared();
    expect(track).toHaveBeenLastCalledWith('community_image_shared', {});

    trackCommunityLocationShared();
    expect(track).toHaveBeenLastCalledWith('community_location_shared', {});
  });

  it('maps the information-hub helpers to their events and payloads', () => {
    trackInfoSectionOpened('laws');
    expect(track).toHaveBeenLastCalledWith('info_section_opened', { section: 'laws' });

    trackLawViewed('law_1', 'Personal Safety');
    expect(track).toHaveBeenLastCalledWith('law_viewed', {
      law_id: 'law_1',
      category: 'Personal Safety',
    });

    trackFaqViewed('faq_1', 'Legal Help');
    expect(track).toHaveBeenLastCalledWith('faq_viewed', {
      faq_id: 'faq_1',
      category: 'Legal Help',
    });

    trackTipsViewed('Travel');
    expect(track).toHaveBeenLastCalledWith('tips_viewed', { category: 'Travel' });

    trackNewsViewed('news_1', 'App News');
    expect(track).toHaveBeenLastCalledWith('news_viewed', {
      news_id: 'news_1',
      category: 'App News',
    });
  });

  it('routes contact-change actions to the matching event', () => {
    trackEmergencyContactChange('added');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_added', {});
    trackEmergencyContactChange('updated');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_updated', {});
    trackEmergencyContactChange('deleted');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_deleted', {});
  });

  it('reports how an SOS ended, not just how many messages went out', () => {
    trackSosOutcome('airplane_mode', 0, 3);
    expect(track).toHaveBeenLastCalledWith('sos_outcome', {
      outcome: 'airplane_mode',
      contacts_count: 0,
      failed_count: 3,
    });

    trackSosOutcome('sent', 2, 0);
    expect(track).toHaveBeenLastCalledWith('sos_outcome', {
      outcome: 'sent',
      contacts_count: 2,
      failed_count: 0,
    });
  });

  it('maps the safety lifecycle helpers that were previously untracked', () => {
    trackSafeJourneyCancelled();
    expect(track).toHaveBeenLastCalledWith('safe_journey_cancelled', {});
    trackLiveLocationExpired();
    expect(track).toHaveBeenLastCalledWith('live_location_expired', {});
    trackSafeCheckinConfirmed();
    expect(track).toHaveBeenLastCalledWith('safe_checkin_confirmed', {});
  });

  it('maps the auth helpers and never sends a phone number', () => {
    trackOtpRequested();
    expect(track).toHaveBeenLastCalledWith('otp_requested', {});

    trackOtpRequestFailed('auth.tooManyRequests');
    expect(track).toHaveBeenLastCalledWith('otp_request_failed', {
      reason: 'auth.tooManyRequests',
    });

    trackOtpVerified(true);
    expect(track).toHaveBeenLastCalledWith('otp_verified', { is_new_user: true });

    trackOtpVerifyFailed('auth.otpInvalid');
    expect(track).toHaveBeenLastCalledWith('otp_verify_failed', { reason: 'auth.otpInvalid' });

    for (const call of jest.mocked(track).mock.calls) {
      expect(JSON.stringify(call)).not.toContain('phone');
    }
  });

  it('maps settings, permission and screen helpers', () => {
    trackSettingChanged('shake_to_sos', false);
    expect(track).toHaveBeenLastCalledWith('setting_changed', {
      setting: 'shake_to_sos',
      enabled: false,
    });

    trackPermissionResult('location', true);
    expect(track).toHaveBeenLastCalledWith('permission_result', {
      permission: 'location',
      granted: true,
    });

    trackScreenViewed('law/[id]');
    expect(track).toHaveBeenLastCalledWith('screen_viewed', { screen: 'law/[id]' });
  });

  it('forwards super and people properties to the config layer', () => {
    setAnalyticsSuperProperties({ app_version: '1.4.2', is_guest: false });
    expect(setSuperProperties).toHaveBeenCalledWith({ app_version: '1.4.2', is_guest: false });

    setAnalyticsUserProperties({ language: 'hi' });
    expect(setPeopleProperties).toHaveBeenCalledWith({ language: 'hi' });
  });
});
