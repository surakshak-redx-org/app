import * as Crypto from 'expo-crypto';

import { APP_CONFIG } from '@/constants/config';
import { buildTrackingUrl, generateShareToken, shouldAppendPoint } from '@/utils/tracking.utils';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

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
