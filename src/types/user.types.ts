import type { Timestamp } from '@react-native-firebase/firestore';

export type Language = 'en' | 'hi' | 'mr';

/** Mirrors Firestore `users/{userId}`. */
export interface User {
  userId: string;
  name: string;
  phone: string;
  profilePhotoUrl: string;
  city: string;
  state: string;
  language: Language;
  isGuest: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Mirrors Firestore `users/{userId}/emergencyContacts/{contactId}`. */
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPredefined: boolean;
  order: number;
}

export type TrustedCircleAlertLevel = 'all' | 'primary';

export interface TrustedCircle {
  id: string;
  name: string;
  contactIds: string[];
  alertLevel: TrustedCircleAlertLevel;
}

export type CreateUserInput = Pick<User, 'name' | 'phone' | 'city' | 'language'>;
