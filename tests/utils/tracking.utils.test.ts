import * as Crypto from 'expo-crypto';

import { APP_CONFIG } from '@/constants/config';
import {
  buildTrackingUrl,
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
