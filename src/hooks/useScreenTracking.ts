import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { ANALYTICS_EXCLUDED_SCREEN_GROUPS, ANALYTICS_ROOT_SCREEN } from '@/constants/analytics';
import { trackScreenViewed } from '@/services/analytics.service';

/**
 * Reports a `screen_viewed` event each time the visible route changes.
 *
 * Uses the route *segments* (`law/[id]`) rather than the pathname
 * (`law/abc123`), so the event names a screen, not a piece of content, and
 * never carries an id. Consecutive duplicates are dropped because segments can
 * re-emit without a navigation (for example a param change).
 */
export function useScreenTracking(): void {
  // Typed routes make this a non-empty tuple, but it is empty at runtime until
  // the navigator is ready, so widen it rather than trust the narrower type.
  const segments: readonly string[] = useSegments();
  const lastScreen = useRef<string | null>(null);

  const [group] = segments;
  const screen = segments.length === 0 ? ANALYTICS_ROOT_SCREEN : segments.join('/');
  const isExcluded = group !== undefined && ANALYTICS_EXCLUDED_SCREEN_GROUPS.includes(group);

  useEffect(() => {
    if (isExcluded || screen === lastScreen.current) return;
    lastScreen.current = screen;
    trackScreenViewed(screen);
  }, [screen, isExcluded]);
}
