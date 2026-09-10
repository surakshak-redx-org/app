import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '@/constants/colors';
import type { HelpCategory, PinColor, UnsafeAreaCategory } from '@/types/location.types';

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

/** Marker tint per pin colour. Orange = pending review, red = verified unsafe. */
export const PIN_HEX: Record<PinColor, string> = {
  orange: COLORS.SAFFRON,
  red: COLORS.PRIMARY_RED,
};

/** Geofence circle stroke per pin colour (semi-opaque). */
export const PIN_CIRCLE_STROKE: Record<PinColor, string> = {
  orange: 'rgba(250,140,22,0.5)',
  red: 'rgba(212,56,13,0.5)',
};

/** Geofence circle fill per pin colour (faint). */
export const PIN_CIRCLE_FILL: Record<PinColor, string> = {
  orange: 'rgba(250,140,22,0.1)',
  red: 'rgba(212,56,13,0.1)',
};

/** i18n key for each unsafe-area category label. */
export const UNSAFE_CATEGORY_LABEL_KEY: Record<UnsafeAreaCategory, string> = {
  poorly_lit: 'map.poorlyLit',
  isolated: 'map.isolated',
  harassment_reported: 'map.harassmentReported',
  other: 'map.other',
};

/** The unsafe-area categories, in the order shown in the report form grid. */
export const UNSAFE_AREA_CATEGORIES: readonly UnsafeAreaCategory[] = [
  'poorly_lit',
  'isolated',
  'harassment_reported',
  'other',
];

/** The nearby-help categories, in tab order. */
export const HELP_CATEGORIES: readonly HelpCategory[] = [
  'police',
  'hospital',
  'fire_station',
  'pharmacy',
];

/** Google Places `type` parameter for each help category. */
export const HELP_PLACES_TYPE: Record<HelpCategory, string> = {
  police: 'police',
  hospital: 'hospital',
  fire_station: 'fire_station',
  pharmacy: 'pharmacy',
};

/** MaterialIcons glyph for each help category. */
export const HELP_CATEGORY_ICON: Record<HelpCategory, MaterialIconName> = {
  police: 'local-police',
  hospital: 'local-hospital',
  fire_station: 'local-fire-department',
  pharmacy: 'local-pharmacy',
};

/** i18n key for each help category tab label. */
export const HELP_CATEGORY_LABEL_KEY: Record<HelpCategory, string> = {
  police: 'location.policeStations',
  hospital: 'location.hospitals',
  fire_station: 'location.fireStations',
  pharmacy: 'location.pharmacies',
};
