import { getDistanceKm, getLocationUrl } from '@/utils/location.utils';

describe('getLocationUrl', () => {
  it('builds the exact format CLAUDE.md mandates', () => {
    expect(getLocationUrl(19.076, 72.8777)).toBe(
      'https://www.google.com/maps/place/19.076,72.8777',
    );
  });

  it('preserves negative coordinates', () => {
    expect(getLocationUrl(-33.8688, -151.2093)).toBe(
      'https://www.google.com/maps/place/-33.8688,-151.2093',
    );
  });
});

describe('getDistanceKm', () => {
  it('returns zero for identical points', () => {
    expect(getDistanceKm(19.076, 72.8777, 19.076, 72.8777)).toBe(0);
  });

  it('measures Mumbai to Delhi at roughly 1150 km', () => {
    const distance = getDistanceKm(19.076, 72.8777, 28.6139, 77.209);
    expect(distance).toBeGreaterThan(1130);
    expect(distance).toBeLessThan(1170);
  });

  it('measures Mumbai to Pune at roughly 120 km', () => {
    const distance = getDistanceKm(19.076, 72.8777, 18.5204, 73.8567);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(130);
  });

  it('is symmetric', () => {
    const forward = getDistanceKm(19.076, 72.8777, 28.6139, 77.209);
    const backward = getDistanceKm(28.6139, 77.209, 19.076, 72.8777);
    expect(forward).toBeCloseTo(backward, 6);
  });
});
