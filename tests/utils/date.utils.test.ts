import {
  toMillis,
  formatClockTime,
  formatCountdown,
  formatDuration,
  formatEta,
  formatTimestamp,
} from '@/utils/date.utils';

describe('formatTimestamp', () => {
  const now = new Date('2026-01-12T15:00:00');

  it('reports "just now" under a minute', () => {
    expect(formatTimestamp(new Date('2026-01-12T14:59:30'), now)).toBe('just now');
  });

  it('singularises one minute', () => {
    expect(formatTimestamp(new Date('2026-01-12T14:59:00'), now)).toBe('1 min ago');
  });

  it('pluralises minutes', () => {
    expect(formatTimestamp(new Date('2026-01-12T14:58:00'), now)).toBe('2 mins ago');
  });

  it('singularises one hour', () => {
    expect(formatTimestamp(new Date('2026-01-12T14:00:00'), now)).toBe('1 hour ago');
  });

  it('pluralises hours', () => {
    expect(formatTimestamp(new Date('2026-01-12T10:00:00'), now)).toBe('5 hours ago');
  });

  it('switches to an absolute date past a day', () => {
    expect(formatTimestamp(new Date('2026-01-09T10:00:00'), now)).toBe('9 Jan 2026');
  });
});

describe('formatDuration', () => {
  it('renders minutes only under an hour', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('renders hours only on the hour', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('renders hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('clamps negatives to zero', () => {
    expect(formatDuration(-10)).toBe('0m');
  });
});

describe('formatEta', () => {
  it('adds the offset and renders a 12-hour clock', () => {
    expect(formatEta(30, new Date('2026-01-12T15:00:00'))).toBe('Arrives at 3:30 PM');
  });

  it('renders midnight as 12 AM', () => {
    expect(formatEta(0, new Date('2026-01-12T00:15:00'))).toBe('Arrives at 12:15 AM');
  });

  it('renders noon as 12 PM', () => {
    expect(formatEta(0, new Date('2026-01-12T12:05:00'))).toBe('Arrives at 12:05 PM');
  });

  it('rolls past midnight', () => {
    expect(formatEta(90, new Date('2026-01-12T23:00:00'))).toBe('Arrives at 12:30 AM');
  });
});

describe('formatCountdown', () => {
  it('uses m:ss under an hour', () => {
    expect(formatCountdown(95)).toBe('1:35');
  });

  it('switches to h:mm:ss at an hour or more', () => {
    expect(formatCountdown(5400)).toBe('1:30:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('formatClockTime', () => {
  it('formats a 12-hour clock time', () => {
    expect(formatClockTime(new Date(2026, 0, 1, 18, 5))).toBe('6:05 PM');
  });
});

describe('toMillis', () => {
  it('reads a Firestore Timestamp, its JSON form, numbers, strings and Dates', () => {
    expect(toMillis({ toMillis: () => 1_000 })).toBe(1_000);
    expect(toMillis({ seconds: 2, nanoseconds: 0 })).toBe(2_000);
    expect(toMillis(3_000)).toBe(3_000);
    expect(toMillis('1970-01-01T00:00:04.000Z')).toBe(4_000);
    expect(toMillis(new Date(5_000))).toBe(5_000);
  });

  it('returns null for anything unreadable', () => {
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis('not a date')).toBeNull();
    expect(toMillis(Number.NaN)).toBeNull();
    expect(toMillis({})).toBeNull();
  });
});

describe('formatTimestamp with an invalid date', () => {
  it('renders nothing rather than "NaN NaN"', () => {
    expect(formatTimestamp(new Date(Number.NaN))).toBe('');
  });
});
