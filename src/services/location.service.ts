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
  PlaceLocation,
  PlaceSuggestion,
  PlacesAutocompleteResponse,
  PlacesNewPlace,
  PlacesSearchNearbyResponse,
} from '@/types/location.types';
import { getDistanceKm, getLocationUrl } from '@/utils/location.utils';
import { requestLocationPermission } from '@/utils/permissions.utils';

// Places API (New) — the legacy `maps.googleapis.com/.../place/*` endpoints are
// not enable-able on newer GCP projects. Enable "Places API (New)" in GCP.
const PLACES_BASE_URL = 'https://places.googleapis.com/v1';

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

/**
 * Headers for a Places API (New) request: the API key plus the app-identity
 * header Google needs to honour the key's Android/iOS application restriction.
 */
function placesHeaders(fieldMask: string): Record<string, string> {
  const isIOS = Platform.OS === 'ios';
  const identity = isIOS
    ? { 'X-Ios-Bundle-Identifier': Constants.expoConfig?.ios?.bundleIdentifier ?? '' }
    : { 'X-Android-Package': Constants.expoConfig?.android?.package ?? '' };
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': isIOS ? ENV.GOOGLE_MAPS_API_KEY_IOS : ENV.GOOGLE_MAPS_API_KEY_ANDROID,
    'X-Goog-FieldMask': fieldMask,
    ...identity,
  };
}

function openNowOf(place: PlacesNewPlace): boolean | null {
  return place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow ?? null;
}

/**
 * Finds nearby police stations, hospitals, fire stations or pharmacies via
 * Places API (New) Nearby Search, sorted by distance from the user.
 * @phase Phase 4 — Location & Maps
 */
export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  category: HelpCategory,
): Promise<NearbyPlace[]> {
  try {
    const response = await fetch(`${PLACES_BASE_URL}/places:searchNearby`, {
      method: 'POST',
      headers: placesHeaders(
        'places.id,places.displayName,places.formattedAddress,places.location,' +
          'places.currentOpeningHours.openNow,places.regularOpeningHours.openNow,' +
          'places.nationalPhoneNumber',
      ),
      body: JSON.stringify({
        includedTypes: [HELP_PLACES_TYPE[category]],
        maxResultCount: APP_CONFIG.NEARBY_HELP_MAX_RESULTS,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: APP_CONFIG.NEARBY_HELP_SEARCH_RADIUS_METERS,
          },
        },
      }),
    });

    const data = (await response.json()) as PlacesSearchNearbyResponse;
    if (!response.ok || data.error !== undefined) {
      throw new Error(data.error?.message ?? 'errors.networkError');
    }

    return (data.places ?? [])
      .filter(
        (place): place is PlacesNewPlace & { location: { latitude: number; longitude: number } } =>
          place.location !== undefined,
      )
      .map((place) => ({
        id: place.id,
        name: place.displayName?.text ?? '',
        address: place.formattedAddress ?? '',
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        isOpen: openNowOf(place),
        distanceKm: getDistanceKm(
          latitude,
          longitude,
          place.location.latitude,
          place.location.longitude,
        ),
        ...(place.nationalPhoneNumber !== undefined
          ? { phoneNumber: place.nationalPhoneNumber }
          : {}),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (error) {
    console.error('fetchNearbyPlaces failed:', error);
    throw error;
  }
}

/**
 * Autocomplete suggestions for a destination query, biased to the user's area.
 * @phase Phase 4 — Location & Maps
 */
export async function autocompletePlaces(
  input: string,
  bias?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  try {
    const response = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
      method: 'POST',
      // Autocomplete's field mask is fixed by the endpoint; send an empty one.
      headers: placesHeaders('*'),
      body: JSON.stringify({
        input,
        includedRegionCodes: ['in'],
        ...(bias !== undefined
          ? {
              locationBias: {
                circle: {
                  center: bias,
                  radius: APP_CONFIG.PLACE_AUTOCOMPLETE_BIAS_RADIUS_METERS,
                },
              },
            }
          : {}),
      }),
    });

    const data = (await response.json()) as PlacesAutocompleteResponse;
    if (!response.ok || data.error !== undefined) {
      throw new Error(data.error?.message ?? 'errors.networkError');
    }

    return (data.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(
        (prediction): prediction is NonNullable<typeof prediction> => prediction !== undefined,
      )
      .map((prediction) => ({
        placeId: prediction.placeId,
        primaryText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? '',
      }));
  } catch (error) {
    console.error('autocompletePlaces failed:', error);
    throw error;
  }
}

/**
 * Resolves an autocomplete `placeId` to a display name and coordinates.
 * @phase Phase 4 — Location & Maps
 */
export async function getPlaceLocation(placeId: string): Promise<PlaceLocation> {
  try {
    const response = await fetch(`${PLACES_BASE_URL}/places/${placeId}`, {
      method: 'GET',
      headers: placesHeaders('id,displayName,location'),
    });

    const data = (await response.json()) as PlacesNewPlace & {
      error?: { message: string };
    };
    if (!response.ok || data.error !== undefined || data.location === undefined) {
      throw new Error(data.error?.message ?? 'errors.networkError');
    }

    return {
      name: data.displayName?.text ?? '',
      latitude: data.location.latitude,
      longitude: data.location.longitude,
    };
  } catch (error) {
    console.error('getPlaceLocation failed:', error);
    throw error;
  }
}
