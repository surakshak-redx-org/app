import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { ROUTES } from '@/constants/routes';
import { MIN_TOUCH_TARGET, SPACING } from '@/constants/spacing';
import { FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS } from '@/constants/typography';

describe('COLORS', () => {
  it('matches the brand palette in CLAUDE.md', () => {
    expect(COLORS.PRIMARY_RED).toBe('#D4380D');
    expect(COLORS.SHAKTI_PURPLE).toBe('#722ED1');
    expect(COLORS.SAFFRON).toBe('#FA8C16');
  });

  it('is entirely six-digit uppercase hex', () => {
    for (const value of Object.values(COLORS)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('typography', () => {
  it('gives every font size a line height', () => {
    expect(Object.keys(LINE_HEIGHTS).sort()).toEqual(Object.keys(FONT_SIZES).sort());
  });

  it('sets each line height to roughly 1.4x its font size', () => {
    for (const [key, size] of Object.entries(FONT_SIZES)) {
      const lineHeight = LINE_HEIGHTS[key as keyof typeof LINE_HEIGHTS];
      expect(lineHeight).toBe(Math.round(size * 1.4));
    }
  });

  it('exposes numeric font weights as strings', () => {
    for (const weight of Object.values(FONT_WEIGHTS)) {
      expect(weight).toMatch(/^[1-9]00$/);
    }
  });
});

describe('spacing', () => {
  it('increases monotonically', () => {
    const values = Object.values(SPACING);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it('meets the platform minimum touch target', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });
});

describe('ROUTES', () => {
  it('starts every route with a slash', () => {
    for (const route of Object.values(ROUTES)) {
      expect(route.startsWith('/')).toBe(true);
    }
  });

  it('has no duplicate paths', () => {
    const values = Object.values(ROUTES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('APP_CONFIG', () => {
  it('keeps the SOS countdown short enough to be useful', () => {
    expect(APP_CONFIG.SOS_COUNTDOWN_SECONDS).toBeGreaterThan(0);
    expect(APP_CONFIG.SOS_COUNTDOWN_SECONDS).toBeLessThanOrEqual(10);
  });

  it('does not let live location outlive its maximum', () => {
    expect(APP_CONFIG.LIVE_LOCATION_DEFAULT_HOURS).toBeLessThanOrEqual(
      APP_CONFIG.LIVE_LOCATION_MAX_HOURS,
    );
  });

  it('is entirely numeric', () => {
    for (const value of Object.values(APP_CONFIG)) {
      expect(typeof value).toBe('number');
    }
  });
});
