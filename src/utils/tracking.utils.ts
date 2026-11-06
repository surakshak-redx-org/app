import * as Crypto from 'expo-crypto';

import { APP_CONFIG } from '@/constants/config';
import type { LiveTrackingProfile } from '@/types/location.types';
import { getDistanceKm } from '@/utils/location.utils';

const METERS_PER_KM = 1000;
const MS_PER_SECOND = 1000;
const PERCENT = 100;
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

export interface TrackingProfileInput {
  /** Metres per second; `undefined` when the device reported no usable speed. */
  speedMps: number | undefined;
  /** 0–1; `undefined` when unavailable. */
  batteryLevel: number | undefined;
  isCharging: boolean;
  /** When the sender last stopped moving, or `null` while moving / unknown. */
  stationarySinceMs: number | null;
  nowMs: number;
}

/**
 * Keeps the stationary clock: starts it when speed drops below walking pace,
 * clears it on any movement, and leaves it alone when speed is unknown (a
 * missing reading must not flip the sender between "moving" and "still").
 */
export function nextStationarySince(
  speedMps: number | undefined,
  previous: number | null,
  nowMs: number,
): number | null {
  if (speedMps === undefined) return previous;
  if (speedMps >= APP_CONFIG.LIVE_LOCATION_WALKING_SPEED_MPS) return null;
  return previous ?? nowMs;
}

/**
 * Chooses how often to sample the next fix. A low battery wins over everything
 * (the sender must still be trackable at 5%), then speed decides, and an
 * unknown speed is treated as walking, the safe middle.
 */
export function selectTrackingProfile(input: TrackingProfileInput): LiveTrackingProfile {
  const { speedMps, batteryLevel, isCharging, stationarySinceMs, nowMs } = input;

  if (
    batteryLevel !== undefined &&
    !isCharging &&
    batteryLevel * PERCENT <= APP_CONFIG.LIVE_LOCATION_LOW_BATTERY_PERCENT
  ) {
    return 'low_battery';
  }

  if (speedMps === undefined) return 'walking';
  if (speedMps >= APP_CONFIG.LIVE_LOCATION_MOVING_SPEED_MPS) return 'moving';
  if (speedMps >= APP_CONFIG.LIVE_LOCATION_WALKING_SPEED_MPS) return 'walking';

  const stillForMs = stationarySinceMs === null ? 0 : nowMs - stationarySinceMs;
  return stillForMs >= APP_CONFIG.LIVE_LOCATION_STATIONARY_AFTER_SECONDS * MS_PER_SECOND
    ? 'stationary'
    : 'walking';
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
