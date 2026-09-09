import { track } from '@/config/mixpanel';
import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetUser,
  trackEvent,
} from '@/services/analytics.service';

jest.mock('@/config/mixpanel', () => ({
  track: jest.fn(),
  identify: jest.fn(),
  resetAnalytics: jest.fn(),
}));

describe('analytics.service', () => {
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
});
