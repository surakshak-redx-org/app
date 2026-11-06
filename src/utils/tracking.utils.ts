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

/** Arrival detection state, persisted between fixes. */
export interface ArrivalState {
  /** Set once the sender has been well away from the destination. */
  armed: boolean;
  /** Consecutive precise fixes inside the arrival radius. */
  insideFixes: number;
}

export const INITIAL_ARRIVAL_STATE: ArrivalState = { armed: false, insideFixes: 0 };

/**
 * Decides whether the sender has reached the destination.
 *
 * Built to avoid ending a share wrongly, which would leave contacts thinking
 * the sender is safe: it only arms after the sender has been far away (so
 * starting next to the destination does nothing), ignores imprecise fixes, and
 * needs several consecutive fixes inside the radius (so one GPS jump can't
 * trigger it).
 */
export function evaluateArrival(
  state: ArrivalState,
  distanceMeters: number,
  accuracyMeters: number | undefined,
): { state: ArrivalState; arrived: boolean } {
  if (
    accuracyMeters !== undefined &&
    accuracyMeters > APP_CONFIG.LIVE_LOCATION_ARRIVAL_MAX_ACCURACY_METERS
  ) {
    return { state, arrived: false };
  }

  if (distanceMeters >= APP_CONFIG.LIVE_LOCATION_ARRIVAL_ARM_METERS) {
    return { state: { armed: true, insideFixes: 0 }, arrived: false };
  }

  if (!state.armed || distanceMeters > APP_CONFIG.LIVE_LOCATION_ARRIVAL_RADIUS_METERS) {
    return { state: { armed: state.armed, insideFixes: 0 }, arrived: false };
  }

  const insideFixes = state.insideFixes + 1;
  return {
    state: { armed: true, insideFixes },
    arrived: insideFixes >= APP_CONFIG.LIVE_LOCATION_ARRIVAL_CONFIRM_FIXES,
  };
}

/** Straight-line distance in metres between two coordinates. */
export function distanceMeters(from: Coordinate, to: Coordinate): number {
  return getDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude) * METERS_PER_KM;
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
