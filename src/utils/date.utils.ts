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

function formatClockTime(date: Date): string {
  const hours24 = date.getHours();
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${pad(date.getMinutes())} ${suffix}`;
}

/** Relative for anything under a day, absolute date beyond that. */
export function formatTimestamp(date: Date, now: Date = new Date()): string {
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
