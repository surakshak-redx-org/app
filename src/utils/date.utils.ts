const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** `Date` → `"3:30 PM"` in ASCII digits, for UI and SMS alike. */
export function formatClockTime(date: Date): string {
  const hours24 = date.getHours();
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${pad(date.getMinutes())} ${suffix}`;
}

const MS_PER_SECOND = 1000;

/**
 * Epoch millis from whatever a date field arrived as: a Firestore Timestamp,
 * its JSON form (`{ seconds }`), a number, an ISO string or a `Date`.
 * `null` when it can't be read.
 */
export function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      const millis = (value as { toMillis: () => unknown }).toMillis();
      return typeof millis === 'number' ? millis : null;
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      return value.seconds * MS_PER_SECOND;
    }
  }
  return null;
}

/** Relative for anything under a day, absolute date beyond that. */
export function formatTimestamp(date: Date, now: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return '';
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / MS_PER_MINUTE);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 min ago';
  if (diffMinutes < MINUTES_PER_HOUR) return `${diffMinutes} mins ago`;

  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours === 1) return '1 hour ago';
  if (diffMinutes < MINUTES_PER_DAY) return `${diffHours} hours ago`;

  const month = MONTHS[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

const SECONDS_PER_MINUTE = 60;

/** `95` → `"1:35"`, `8` → `"0:08"` — a running-clock style, not `formatDuration`'s minutes rounding. */
export function formatSecondsAsClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const secs = safeSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/** `90` → `"1h 30m"`, `45` → `"45m"`, `120` → `"2h"`. */
export function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const mins = safeMinutes % MINUTES_PER_HOUR;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
}

/** `30` → `"Arrives at 3:30 PM"`, relative to `from`. */
export function formatEta(minutes: number, from: Date = new Date()): string {
  const arrival = new Date(from.getTime() + minutes * MS_PER_MINUTE);
  return `Arrives at ${formatClockTime(arrival)}`;
}

const SECONDS_PER_HOUR = 3600;

/** `5400` → `"1:30:00"`, `95` → `"1:35"` — a live countdown that stays exact past an hour. */
export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / SECONDS_PER_HOUR);
  if (hours === 0) return formatSecondsAsClock(safeSeconds);
  const rest = safeSeconds % SECONDS_PER_HOUR;
  return `${hours}:${pad(Math.floor(rest / SECONDS_PER_MINUTE))}:${pad(rest % SECONDS_PER_MINUTE)}`;
}
