import {
  buildLowBatteryMessage,
  buildSOSMessage,
  buildSafeJourneyMessage,
} from '@/utils/sms.utils';

const LOCATION_URL = 'https://www.google.com/maps/place/19.076,72.8777';

describe('buildSOSMessage', () => {
  it('names the user and carries the location link', () => {
    const message = buildSOSMessage('Priya', LOCATION_URL, 'en');
    expect(message).toContain('Priya');
    expect(message).toContain(LOCATION_URL);
    expect(message).toContain('EMERGENCY');
  });

  // TODO: Phase 8 — assert real translations once hi/mr are reviewed.
  it.each(['hi', 'mr'] as const)('falls back to English for %s until Phase 8', (language) => {
    expect(buildSOSMessage('Priya', LOCATION_URL, language)).toBe(
      buildSOSMessage('Priya', LOCATION_URL, 'en'),
    );
  });
});

describe('buildLowBatteryMessage', () => {
  it('names the user and carries the location link', () => {
    const message = buildLowBatteryMessage('Priya', LOCATION_URL, 'en');
    expect(message).toContain('Priya');
    expect(message).toContain(LOCATION_URL);
    expect(message).toContain('battery');
  });
});

describe('buildSafeJourneyMessage', () => {
  it('names the destination and arrival time', () => {
    const message = buildSafeJourneyMessage('Priya', 'Andheri Station', '3:30 PM', 'en');
    expect(message).toContain('Priya');
    expect(message).toContain('Andheri Station');
    expect(message).toContain('3:30 PM');
  });
});
