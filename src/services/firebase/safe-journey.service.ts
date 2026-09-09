import type { SafeJourneySession } from '@/types/location.types';

/**
 * Starts a monitored journey. Contacts are alerted if the user misses check-in.
 * @phase Phase 7 — Advanced Safety
 */
export function startSafeJourney(
  _userId: string,
  _destinationName: string,
  _destinationLatitude: number,
  _destinationLongitude: number,
  _etaMinutes: number,
  _sharedWithUserIds: string[],
): Promise<SafeJourneySession> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Marks a journey as safely arrived.
 * @phase Phase 7 — Advanced Safety
 */
export function markJourneyArrived(_sessionId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Pushes the expected arrival time back.
 * @phase Phase 7 — Advanced Safety
 */
export function extendJourneyEta(_sessionId: string, _additionalMinutes: number): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Cancels a journey without alerting contacts.
 * @phase Phase 7 — Advanced Safety
 */
export function cancelSafeJourney(_sessionId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}
