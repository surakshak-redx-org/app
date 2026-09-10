import * as Location from 'expo-location';

import type { LocationData } from '@/types/location.types';
import { getLocationUrl } from '@/utils/location.utils';
import { requestLocationPermission } from '@/utils/permissions.utils';

/**
 * Reads the device's current position. Used by the SOS fan-out and the
 * low-battery alert to attach a shareable location link.
 * @phase Phase 3 — Emergency Core (foreground fix only; watching is Phase 4)
 */
export async function getCurrentLocation(): Promise<LocationData> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) {
      throw new Error('errors.locationPermissionDenied');
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp,
      ...(position.coords.accuracy != null ? { accuracy: position.coords.accuracy } : {}),
    };
  } catch (error) {
    console.error('getCurrentLocation failed:', error);
    throw error;
  }
}

/** The one canonical share-link format for a coordinate. */
export function buildLocationUrl(latitude: number, longitude: number): string {
  return getLocationUrl(latitude, longitude);
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
