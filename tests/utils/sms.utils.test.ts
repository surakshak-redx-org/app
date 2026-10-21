import type { Language } from '@/types/user.types';
import {
  buildLiveLocationMessage,
  buildLowBatteryMessage,
  buildSafeJourneyEtaExtendedMessage,
  buildSafeJourneyMessage,
  buildSafeJourneyStartMessage,
  buildSOSMessage,
  calculateSMSCharacterCount,
  interpolateSOSTemplate,
  isGsm7String,
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
  it.each(LANGUAGES)('names the destination, arrival time and location link for %s', (language) => {
    const message = buildSafeJourneyMessage(
      'Priya',
      'Andheri Station',
      '3:30 PM',
      LOCATION_URL,
      language,
    );
    expect(message).toContain('Priya');
    expect(message).toContain('Andheri Station');
    expect(message).toContain('3:30 PM');
    expect(message).toContain(LOCATION_URL);
  });
});

describe('buildSafeJourneyStartMessage', () => {
  it.each(LANGUAGES)('is informational, not an overdue warning (%s)', (language) => {
    const message = buildSafeJourneyStartMessage(
      'Priya',
      'Andheri',
      '6:30 PM',
      LOCATION_URL,
      language,
    );
    expect(message).toContain('Priya');
    expect(message).toContain('Andheri');
    expect(message).toContain('6:30 PM');
    expect(message).toContain(LOCATION_URL);
    expect(message).not.toBe(
      buildSafeJourneyMessage('Priya', 'Andheri', '6:30 PM', LOCATION_URL, language),
    );
  });

  it('does not tell contacts to check on her (en)', () => {
    expect(
      buildSafeJourneyStartMessage('Priya', 'Andheri', '6:30 PM', LOCATION_URL, 'en'),
    ).not.toMatch(/has not checked in|immediately/);
  });
});

describe('buildSafeJourneyEtaExtendedMessage', () => {
  it.each(LANGUAGES)('notifies contacts of the new expected arrival time (%s)', (language) => {
    const message = buildSafeJourneyEtaExtendedMessage('Priya', 'Andheri', '7:00 PM', language);
    expect(message).toContain('Priya');
    expect(message).toContain('Andheri');
    expect(message).toContain('7:00 PM');
  });
});

describe('buildLiveLocationMessage', () => {
  it.each(LANGUAGES)('shares the link and end time without an SOS (%s)', (language) => {
    const message = buildLiveLocationMessage('Priya', LOCATION_URL, '9:00 PM', language);
    expect(message).toContain(LOCATION_URL);
    expect(message).toContain('9:00 PM');
    expect(message).not.toMatch(/SOS|EMERGENCY/);
  });
});

describe('templates', () => {
  it.each(LANGUAGES)('contain no emoji, which would force UCS-2 segments (%s)', (language) => {
    const messages = [
      buildSOSMessage('Priya', LOCATION_URL, language),
      buildLowBatteryMessage('Priya', LOCATION_URL, language),
      buildSafeJourneyMessage('Priya', 'Andheri', '6:30 PM', LOCATION_URL, language),
      buildSafeJourneyStartMessage('Priya', 'Andheri', '6:30 PM', LOCATION_URL, language),
      buildSafeJourneyEtaExtendedMessage('Priya', 'Andheri', '7:00 PM', language),
      buildLiveLocationMessage('Priya', LOCATION_URL, '9:00 PM', language),
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('isGsm7String', () => {
  it('returns true for pure GSM-7 character sets', () => {
    expect(isGsm7String('Hello world! Emergency alert 123.')).toBe(true);
    expect(isGsm7String('https://maps.google.com/?q=19.076,72.877')).toBe(true);
  });

  it('returns false for Devanagari text', () => {
    expect(isGsm7String('नमस्ते दुनिया')).toBe(false);
  });

  it('returns false for emojis', () => {
    expect(isGsm7String('Emergency 🚨')).toBe(false);
  });
});

describe('calculateSMSCharacterCount', () => {
  it('calculates GSM-7 segments for English text', () => {
    const single = calculateSMSCharacterCount('Hello world');
    expect(single.isUnicode).toBe(false);
    expect(single.charCount).toBe(11);
    expect(single.segmentLimit).toBe(160);
    expect(single.segments).toBe(1);
    expect(single.remainingInSegment).toBe(149);

    const longText = 'A'.repeat(165);
    const multi = calculateSMSCharacterCount(longText);
    expect(multi.isUnicode).toBe(false);
    expect(multi.segments).toBe(2);
  });

  it('calculates UCS-2 Unicode segments for Devanagari text', () => {
    const single = calculateSMSCharacterCount('मुझे तुरंत मदद चाहिए।');
    expect(single.isUnicode).toBe(true);
    expect(single.segments).toBe(1);
    expect(single.segmentLimit).toBe(70);

    const longHindi = 'मदद '.repeat(20); // 80 chars
    const multi = calculateSMSCharacterCount(longHindi);
    expect(multi.isUnicode).toBe(true);
    expect(multi.segments).toBe(2);
  });
});

describe('interpolateSOSTemplate', () => {
  it('interpolates {name}, {location}, and {battery}', () => {
    const template = 'EMERGENCY: {name} needs help at {location}. Battery: {battery}.';
    const result = interpolateSOSTemplate(template, {
      name: 'Asha',
      locationUrl: 'https://maps.google.com/?q=19.076,72.877',
      battery: 0.15,
    });

    expect(result).toBe(
      'EMERGENCY: Asha needs help at https://maps.google.com/?q=19.076,72.877. Battery: 15%.',
    );
  });

  it('replaces tokens case-insensitively and handles missing battery', () => {
    const template = 'ALERT: {NAME} at {Location}. Bat: {BATTERY}';
    const result = interpolateSOSTemplate(template, {
      name: 'Priya',
      locationUrl: 'https://loc',
    });

    expect(result).toBe('ALERT: Priya at https://loc. Bat: N/A');
  });
});

describe('buildSOSMessage with custom template', () => {
  it('uses custom template when provided', () => {
    const custom = 'CODE RED: {name} is at {location}';
    const message = buildSOSMessage('Asha', LOCATION_URL, 'en', custom);
    expect(message).toBe(`CODE RED: Asha is at ${LOCATION_URL}`);
  });

  it('falls back to default template when custom template is empty or whitespace', () => {
    const message = buildSOSMessage('Asha', LOCATION_URL, 'en', '   ');
    expect(message).toContain('SOS EMERGENCY ALERT from Asha');
  });
});
