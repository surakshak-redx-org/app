import * as Crypto from 'expo-crypto';

import { APP_CONFIG } from '@/constants/config';
import {
  type ArrivalState,
  INITIAL_ARRIVAL_STATE,
  buildTrackingUrl,
  distanceMeters,
  evaluateArrival,
  generateShareToken,
  nextStationarySince,
  selectTrackingProfile,
  shouldAppendPoint,
  type TrackingProfileInput,
} from '@/utils/tracking.utils';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

const NOW = 1_700_000_000_000;
const STILL_FOR_LONG = NOW - (APP_CONFIG.LIVE_LOCATION_STATIONARY_AFTER_SECONDS + 1) * 1000;

function input(overrides: Partial<TrackingProfileInput> = {}): TrackingProfileInput {
  return {
    speedMps: 1.4,
    batteryLevel: 0.8,
    isCharging: false,
    stationarySinceMs: null,
    nowMs: NOW,
    ...overrides,
  };
}

describe('selectTrackingProfile', () => {
  it.each([
    [0, 'walking'],
    [APP_CONFIG.LIVE_LOCATION_WALKING_SPEED_MPS, 'walking'],
    [1.4, 'walking'],
    [APP_CONFIG.LIVE_LOCATION_MOVING_SPEED_MPS - 0.01, 'walking'],
    [APP_CONFIG.LIVE_LOCATION_MOVING_SPEED_MPS, 'moving'],
    [20, 'moving'],
  ])('speed %p m/s gives %s', (speedMps, expected) => {
    expect(selectTrackingProfile(input({ speedMps }))).toBe(expected);
  });

  it('treats an unknown speed as walking', () => {
    expect(selectTrackingProfile(input({ speedMps: undefined }))).toBe('walking');
  });

  it('only goes stationary after standing still long enough', () => {
    const justStopped = input({ speedMps: 0, stationarySinceMs: NOW - 1000 });
    const longStopped = input({ speedMps: 0, stationarySinceMs: STILL_FOR_LONG });
    expect(selectTrackingProfile(justStopped)).toBe('walking');
    expect(selectTrackingProfile(longStopped)).toBe('stationary');
  });

  it('does not go stationary when the stationary clock is not running', () => {
    expect(selectTrackingProfile(input({ speedMps: 0, stationarySinceMs: null }))).toBe('walking');
  });

  it('uses battery saver at or below the low-battery threshold, even while moving', () => {
    const threshold = APP_CONFIG.LIVE_LOCATION_LOW_BATTERY_PERCENT / 100;
    expect(selectTrackingProfile(input({ speedMps: 20, batteryLevel: threshold }))).toBe(
      'low_battery',
    );
    expect(selectTrackingProfile(input({ speedMps: 20, batteryLevel: threshold + 0.01 }))).toBe(
      'moving',
    );
  });

  it('ignores a low battery while charging', () => {
    expect(
      selectTrackingProfile(input({ speedMps: 20, batteryLevel: 0.05, isCharging: true })),
    ).toBe('moving');
  });

  it('ignores an unknown battery level', () => {
    expect(selectTrackingProfile(input({ speedMps: 20, batteryLevel: undefined }))).toBe('moving');
  });
});

describe('evaluateArrival', () => {
  const RADIUS = APP_CONFIG.LIVE_LOCATION_ARRIVAL_RADIUS_METERS;
  const ARM = APP_CONFIG.LIVE_LOCATION_ARRIVAL_ARM_METERS;
  const ARMED: ArrivalState = { armed: true, insideFixes: 0 };

  it('arms once the sender is well away from the destination', () => {
    const result = evaluateArrival(INITIAL_ARRIVAL_STATE, ARM, 10);
    expect(result).toEqual({ state: { armed: true, insideFixes: 0 }, arrived: false });
  });

  it('does nothing when the share starts right next to the destination', () => {
    const result = evaluateArrival(INITIAL_ARRIVAL_STATE, 20, 10);
    expect(result).toEqual({ state: INITIAL_ARRIVAL_STATE, arrived: false });
  });

  it('needs several consecutive fixes inside the radius', () => {
    const first = evaluateArrival(ARMED, RADIUS - 1, 10);
    expect(first).toEqual({ state: { armed: true, insideFixes: 1 }, arrived: false });

    const second = evaluateArrival(first.state, RADIUS - 1, 10);
    expect(second.arrived).toBe(true);
  });

  it('counts a fix exactly on the radius as inside', () => {
    expect(evaluateArrival({ armed: true, insideFixes: 1 }, RADIUS, 10).arrived).toBe(true);
  });

  it('resets the inside count when the sender drifts back out', () => {
    const result = evaluateArrival({ armed: true, insideFixes: 1 }, RADIUS + 50, 10);
    expect(result).toEqual({ state: { armed: true, insideFixes: 0 }, arrived: false });
  });

  it('ignores imprecise fixes entirely', () => {
    const state: ArrivalState = { armed: true, insideFixes: 1 };
    const tooVague = APP_CONFIG.LIVE_LOCATION_ARRIVAL_MAX_ACCURACY_METERS + 1;
    expect(evaluateArrival(state, 5, tooVague)).toEqual({ state, arrived: false });
    expect(evaluateArrival(INITIAL_ARRIVAL_STATE, ARM + 500, tooVague).state.armed).toBe(false);
  });

  it('accepts a fix with unknown accuracy', () => {
    expect(evaluateArrival({ armed: true, insideFixes: 1 }, 5, undefined).arrived).toBe(true);
  });
});

describe('distanceMeters', () => {
  it('measures straight-line metres between coordinates', () => {
    const from = { latitude: 19.076, longitude: 72.8777 };
    const to = { latitude: 19.077, longitude: 72.8777 };
    expect(distanceMeters(from, to)).toBeGreaterThan(100);
    expect(distanceMeters(from, to)).toBeLessThan(125);
    expect(distanceMeters(from, from)).toBe(0);
  });
});

describe('nextStationarySince', () => {
  it('starts the clock when speed drops below walking pace', () => {
    expect(nextStationarySince(0, null, NOW)).toBe(NOW);
  });

  it('keeps the original start while still stationary', () => {
    expect(nextStationarySince(0.1, STILL_FOR_LONG, NOW)).toBe(STILL_FOR_LONG);
  });

  it('clears the clock on any movement', () => {
    expect(nextStationarySince(2, STILL_FOR_LONG, NOW)).toBeNull();
  });

  it('leaves the clock alone when speed is unknown', () => {
    expect(nextStationarySince(undefined, STILL_FOR_LONG, NOW)).toBe(STILL_FOR_LONG);
    expect(nextStationarySince(undefined, null, NOW)).toBeNull();
  });
});

describe('generateShareToken', () => {
  it('returns 128 bits as zero-padded lowercase hex', async () => {
    jest
      .mocked(Crypto.getRandomBytesAsync)
      .mockResolvedValueOnce(new Uint8Array([0, 1, 15, 16, 255, 171]));

    await expect(generateShareToken()).resolves.toBe('00010f10ffab');
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(
      APP_CONFIG.LIVE_LOCATION_SHARE_TOKEN_BYTES,
    );
  });
});

describe('buildTrackingUrl', () => {
  it('joins base and token without doubling slashes', () => {
    expect(buildTrackingUrl('https://track.example.com/', 'abc')).toBe(
      'https://track.example.com/abc',
    );
    expect(buildTrackingUrl('https://track.example.com', 'abc')).toBe(
      'https://track.example.com/abc',
    );
  });

  it('returns null when no tracking page is configured', () => {
    expect(buildTrackingUrl(undefined, 'abc')).toBeNull();
    expect(buildTrackingUrl('', 'abc')).toBeNull();
  });
});

describe('shouldAppendPoint', () => {
  const origin = { latitude: 19.076, longitude: 72.8777 };

  it('always records the first point', () => {
    expect(shouldAppendPoint(null, origin)).toBe(true);
  });

  it('skips points that have not moved far enough', () => {
    // ~11 m north, below the 25 m threshold.
    expect(shouldAppendPoint(origin, { latitude: 19.0761, longitude: 72.8777 })).toBe(false);
  });

  it('records points beyond the decimation distance', () => {
    // ~111 m north.
    expect(shouldAppendPoint(origin, { latitude: 19.077, longitude: 72.8777 })).toBe(true);
  });
});
