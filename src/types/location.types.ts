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

/** A single place returned by the Google Places Nearby Search API, normalised. */
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
  /** Nearby Search never returns a phone number — present only if enriched later. */
  phoneNumber?: string;
}

/** The shape of one entry in a Places Nearby Search response. */
export interface PlacesApiResult {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry: { location: { lat: number; lng: number } };
  opening_hours?: { open_now?: boolean };
}

/** The top-level Places Nearby Search response. */
export interface PlacesApiResponse {
  status: string;
  results: PlacesApiResult[];
  error_message?: string;
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
