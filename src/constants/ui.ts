/**
 * Shared UI dimensions so the same visual role gets the same value everywhere
 * (absolute rule 9). Sizes are `MaterialIcons` pixel sizes.
 */
export const ICON_SIZE = {
  /** Top-left back chevron on a stacked screen. */
  BACK: 24,
  /** Leading icon on a settings/profile list row. */
  ROW: 22,
  /** Trailing "navigates onward" chevron on a list row. */
  CHEVRON: 20,
  /** Status glyph inside a card (checkmark, lock). */
  STATUS: 22,
  /** Leading icon on an onboarding permission card. */
  PERMISSION: 24,
  /** Lock icon in the guest banner. */
  BANNER: 24,
  /** The shield mark on the welcome screen. */
  BRAND: 80,
  /** Small dismiss/close glyph on an inline banner or chip. */
  DISMISS: 14,
} as const;

export const TIMING = {
  /** One second — countdown tick interval. */
  SECOND_MS: 1000,
} as const;

/** Touch-target padding for a text-only destructive row. */
export const DANGER_ROW_HITSLOP = 12;

/**
 * Shared `FlatList` performance props for any list that can realistically
 * grow past a screenful — spread onto every `FlatList` in the app so the
 * same windowing behavior applies everywhere.
 */
export const FLATLIST_PERF_PROPS = {
  windowSize: 10,
  maxToRenderPerBatch: 5,
  initialNumToRender: 8,
  removeClippedSubviews: true,
} as const;
