import type { LiveLocationSession } from '@/types/location.types';

/**
 * Starts a live-location session shared with the given contacts.
 * @phase Phase 4 — Location & Maps
 */
export function startLiveLocationSession(
  _userId: string,
  _sharedWithUserIds: string[],
  _durationHours: number,
): Promise<LiveLocationSession> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Pushes a new coordinate into an active session.
 * @phase Phase 4 — Location & Maps
 */
export function updateLiveLocation(
  _sessionId: string,
  _latitude: number,
  _longitude: number,
): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Ends a live-location session early.
 * @phase Phase 4 — Location & Maps
 */
export function stopLiveLocationSession(_sessionId: string): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Extends an active session's expiry, capped at the configured maximum.
 * @phase Phase 4 — Location & Maps
 */
export function extendLiveLocationSession(
  _sessionId: string,
  _additionalHours: number,
): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}
