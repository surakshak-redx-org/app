import type { Timestamp } from '@react-native-firebase/firestore';

export type UnsafeAreaCategory = 'poorly_lit' | 'isolated' | 'harassment_reported' | 'other';
export type UnsafeAreaStatus = 'pending' | 'approved';
export type PinColor = 'orange' | 'red';
export type SafeJourneyStatus = 'active' | 'arrived' | 'alert_sent' | 'cancelled';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

/** Mirrors Firestore `liveLocationSessions/{sessionId}`. */
export interface LiveLocationSession {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  locationUrl: string;
  sharedWithUserIds: string[];
  startedAt: Timestamp;
  expiresAt: Timestamp;
  isActive: boolean;
}

/** Mirrors Firestore `safeJourneySessions/{sessionId}`. */
export interface SafeJourneySession {
  id: string;
  userId: string;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  etaMinutes: number;
  sharedWithUserIds: string[];
  startedAt: Timestamp;
  expectedArrivalAt: Timestamp;
  status: SafeJourneyStatus;
}

/** Categories of nearby assistance the Nearby Help screen can search for. */
export type HelpCategory = 'police' | 'hospital' | 'fire_station' | 'pharmacy';

/** A single place from Places API (New) Nearby Search, normalised for the UI. */
export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** `null` when the API did not report opening hours for this place. */
  isOpen: boolean | null;
  /** Straight-line distance from the user, in kilometres. */
  distanceKm: number;
  /** `nationalPhoneNumber` when the API returned one. */
  phoneNumber?: string;
}

/* ---------------- Places API (New) response shapes ---------------- */

/** One place object in a Places API (New) response (only the fields we mask in). */
export interface PlacesNewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { openNow?: boolean };
  nationalPhoneNumber?: string;
}

export interface PlacesSearchNearbyResponse {
  places?: PlacesNewPlace[];
  error?: { code: number; message: string; status: string };
}

/** A place suggestion for the destination autocomplete field. */
export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface PlacesAutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
  error?: { code: number; message: string; status: string };
}

/** A resolved destination: display name plus coordinates. */
export interface PlaceLocation {
  name: string;
  latitude: number;
  longitude: number;
}

/** Mirrors Firestore `unsafeAreas/{areaId}`. */
export interface UnsafeArea {
  id: string;
  reportedBy: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  title: string;
  description: string;
  category: UnsafeAreaCategory;
  status: UnsafeAreaStatus;
  pinColor: PinColor;
  upvotes: number;
  downvotes: number;
  voterIds: string[];
  createdAt: Timestamp;
}
