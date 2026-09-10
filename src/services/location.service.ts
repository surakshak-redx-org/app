import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { ENV } from '@/config/env';
import { APP_CONFIG } from '@/constants/config';
import { HELP_PLACES_TYPE } from '@/constants/map';
import type {
  HelpCategory,
  LocationData,
  NearbyPlace,
  PlacesApiResponse,
} from '@/types/location.types';
import { getDistanceKm, getLocationUrl } from '@/utils/location.utils';
import { requestLocationPermission } from '@/utils/permissions.utils';

const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

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
 * Starts a foreground position watch. Returns an unsubscribe function; the
 * underlying subscription is torn down once it resolves.
 * @phase Phase 4 — Location & Maps
 */
export function watchLocation(onChange: (location: LocationData) => void): () => void {
  const subscriptionPromise = Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: APP_CONFIG.LIVE_LOCATION_UPDATE_INTERVAL_SECONDS * 1000,
      distanceInterval: APP_CONFIG.LIVE_LOCATION_DISTANCE_INTERVAL_METERS,
    },
    (position) => {
      onChange({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: position.timestamp,
        ...(position.coords.accuracy != null ? { accuracy: position.coords.accuracy } : {}),
      });
    },
  ).catch((error: unknown) => {
    console.error('watchLocation failed:', error);
    return null;
  });

  return (): void => {
    void subscriptionPromise.then((subscription) => subscription?.remove());
  };
}

/**
 * Reverse-geocodes a coordinate into a city and state.
 * @phase Phase 4 — Location & Maps
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ city: string; state: string }> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    return {
      city: first?.city ?? first?.subregion ?? '',
      state: first?.region ?? '',
    };
  } catch (error) {
    console.error('reverseGeocode failed:', error);
    throw error;
  }
}

/** The platform-restricted Maps key, plus the header Google needs to honour it. */
function placesAuth(): { key: string; headers: Record<string, string> } {
  if (Platform.OS === 'ios') {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? '';
    return {
      key: ENV.GOOGLE_MAPS_API_KEY_IOS,
      headers: { 'X-Ios-Bundle-Identifier': bundleId },
    };
  }
  const androidPackage = Constants.expoConfig?.android?.package ?? '';
  return {
    key: ENV.GOOGLE_MAPS_API_KEY_ANDROID,
    headers: { 'X-Android-Package': androidPackage },
  };
}

/**
 * Finds nearby police stations, hospitals, fire stations or pharmacies via the
 * Google Places Nearby Search API, sorted by distance from the user.
 * @phase Phase 4 — Location & Maps
 */
export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  category: HelpCategory,
): Promise<NearbyPlace[]> {
  try {
    const { key, headers } = placesAuth();
    const url =
      `${PLACES_NEARBY_URL}?location=${latitude},${longitude}` +
      `&radius=${APP_CONFIG.NEARBY_HELP_SEARCH_RADIUS_METERS}` +
      `&type=${HELP_PLACES_TYPE[category]}` +
      `&key=${key}`;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('errors.networkError');

    const data = (await response.json()) as PlacesApiResponse;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(data.error_message ?? `Places API error: ${data.status}`);
    }

    return data.results
      .map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity ?? '',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        isOpen: place.opening_hours?.open_now ?? null,
        distanceKm: getDistanceKm(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (error) {
    console.error('fetchNearbyPlaces failed:', error);
    throw error;
  }
}
