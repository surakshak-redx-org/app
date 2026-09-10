import { track } from '@/config/mixpanel';
import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetUser,
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
  trackSosCancelled,
  trackSosTriggered,
  trackUnsafeAreaReported,
  trackUnsafeAreaVoted,
} from '@/services/analytics.service';

jest.mock('@/config/mixpanel', () => ({
  track: jest.fn(),
  identify: jest.fn(),
  resetAnalytics: jest.fn(),
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

  it('routes contact-change actions to the matching event', () => {
    trackEmergencyContactChange('added');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_added', {});
    trackEmergencyContactChange('updated');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_updated', {});
    trackEmergencyContactChange('deleted');
    expect(track).toHaveBeenLastCalledWith('emergency_contact_deleted', {});
  });
});
