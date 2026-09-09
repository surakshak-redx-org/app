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
