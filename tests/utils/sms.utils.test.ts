import type { Language } from '@/types/user.types';
import {
  buildLowBatteryMessage,
  buildSOSMessage,
  buildSafeJourneyMessage,
} from '@/utils/sms.utils';

const LOCATION_URL = 'https://www.google.com/maps/place/19.076,72.8777';
const LANGUAGES: readonly Language[] = ['en', 'hi', 'mr'];

describe('buildSOSMessage', () => {
  it('names the user and carries the location link (en)', () => {
    const message = buildSOSMessage('Priya', LOCATION_URL, 'en');
    expect(message).toContain('Priya');
    expect(message).toContain(LOCATION_URL);
    expect(message).toContain('EMERGENCY');
  });

  it.each(LANGUAGES)('returns a non-empty localized message with the link for %s', (language) => {
    const message = buildSOSMessage('Priya', LOCATION_URL, language);
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain('Priya');
    expect(message).toContain(LOCATION_URL);
  });

  it('uses distinct copy for hi and mr (not the English string)', () => {
    const en = buildSOSMessage('Priya', LOCATION_URL, 'en');
    expect(buildSOSMessage('Priya', LOCATION_URL, 'hi')).not.toBe(en);
    expect(buildSOSMessage('Priya', LOCATION_URL, 'mr')).not.toBe(en);
  });

  it.each(LANGUAGES)(
    'renders the timestamp in ASCII digits regardless of language (%s)',
    (language) => {
      const message = buildSOSMessage('Priya', LOCATION_URL, language);
      // Devanagari numerals (०-९) must never appear — emergency numbers/times stay ASCII.
      expect(message).not.toMatch(/[०-९]/u);
    },
  );
});

describe('buildLowBatteryMessage', () => {
  it.each(LANGUAGES)('names the user and carries the location link for %s', (language) => {
    const message = buildLowBatteryMessage('Priya', LOCATION_URL, language);
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain('Priya');
    expect(message).toContain(LOCATION_URL);
  });
});

describe('buildSafeJourneyMessage', () => {
  it.each(LANGUAGES)('names the destination and arrival time for %s', (language) => {
    const message = buildSafeJourneyMessage('Priya', 'Andheri Station', '3:30 PM', language);
    expect(message).toContain('Priya');
    expect(message).toContain('Andheri Station');
    expect(message).toContain('3:30 PM');
  });
});
