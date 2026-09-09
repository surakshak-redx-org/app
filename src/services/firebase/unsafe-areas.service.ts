import type { UnsafeArea } from '@/types/location.types';

/**
 * Fetches approved and pending unsafe areas within a radius of a point.
 * @phase Phase 4 — Location & Maps
 */
export function getNearbyUnsafeAreas(
  _latitude: number,
  _longitude: number,
  _radiusKm: number,
): Promise<UnsafeArea[]> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Submits a new unsafe-area report for moderation.
 * @phase Phase 4 — Location & Maps
 */
export function reportUnsafeArea(
  _userId: string,
  _area: Omit<UnsafeArea, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'voterIds' | 'status'>,
): Promise<UnsafeArea> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Records an up or down vote. One vote per user per area.
 * @phase Phase 4 — Location & Maps
 */
export function voteOnUnsafeArea(
  _areaId: string,
  _userId: string,
  _isUpvote: boolean,
): Promise<void> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}
