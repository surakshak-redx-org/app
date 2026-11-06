/** Name reported for the root route, whose segment list is empty. */
export const ANALYTICS_ROOT_SCREEN = 'root';

/**
 * Route groups that never produce `screen_viewed`. The disguise calculator is
 * the app pretending to be something else; it should not announce itself in
 * analytics on every launch.
 */
export const ANALYTICS_EXCLUDED_SCREEN_GROUPS: readonly string[] = ['(disguise)'];
