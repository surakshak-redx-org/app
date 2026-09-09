import type { LocationData } from '@/types/location.types';

/**
 * Reads the device's current position.
 * @phase Phase 4 — Location & Maps
 */
export function getCurrentLocation(): Promise<LocationData> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Starts a foreground position watch.
 * @phase Phase 4 — Location & Maps
 */
export function watchLocation(_onChange: (location: LocationData) => void): () => void {
  throw new Error('Not implemented — Phase 4');
}

/**
 * Reverse-geocodes a coordinate into a city and state.
 * @phase Phase 4 — Location & Maps
 */
export function reverseGeocode(
  _latitude: number,
  _longitude: number,
): Promise<{ city: string; state: string }> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}

/**
 * Finds nearby police stations, hospitals, fire stations or pharmacies.
 * @phase Phase 7 — Advanced Safety
 */
export function findNearbyPlaces(
  _latitude: number,
  _longitude: number,
  _placeType: string,
): Promise<unknown[]> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}
