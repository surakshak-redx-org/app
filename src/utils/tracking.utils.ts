import * as Crypto from 'expo-crypto';

import { APP_CONFIG } from '@/constants/config';
import { getDistanceKm } from '@/utils/location.utils';

const METERS_PER_KM = 1000;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Generates the unguessable token embedded in a tracking link: 128 random bits
 * as lowercase hex (URL-safe, no padding, no `Buffer` needed on React Native).
 */
export async function generateShareToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(APP_CONFIG.LIVE_LOCATION_SHARE_TOKEN_BYTES);
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join(
    '',
  );
}

/** Builds `<base>/<token>`, or `null` when no tracking page is configured. */
export function buildTrackingUrl(baseUrl: string | undefined, token: string): string | null {
  if (baseUrl === undefined || baseUrl.length === 0) return null;
  return `${baseUrl.replace(/\/+$/, '')}/${token}`;
}

/**
 * Route-trail decimation: record a new point only once the user has moved far
 * enough from the last recorded one. Keeps Firestore writes and the viewer's
 * polyline small while stationary.
 */
export function shouldAppendPoint(last: Coordinate | null, next: Coordinate): boolean {
  if (last === null) return true;
  const movedMeters =
    getDistanceKm(last.latitude, last.longitude, next.latitude, next.longitude) * METERS_PER_KM;
  return movedMeters >= APP_CONFIG.LIVE_LOCATION_TRAIL_MIN_DISTANCE_METERS;
}
