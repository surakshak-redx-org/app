import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';

import { firestore } from '@/config/firebase';
import { APP_CONFIG } from '@/constants/config';
import type { LiveLocationSession } from '@/types/location.types';
import { getLocationUrl } from '@/utils/location.utils';

const SESSIONS_COLLECTION = 'liveLocationSessions';
const MS_PER_HOUR = 60 * 60 * 1000;

function sessionsCollection(): ReturnType<typeof collection> {
  return collection(firestore, SESSIONS_COLLECTION);
}

function sessionDoc(sessionId: string): ReturnType<typeof doc> {
  return doc(firestore, SESSIONS_COLLECTION, sessionId);
}

/**
 * Creates a live-location session shared with the given contacts and returns
 * its Firestore id.
 * @phase Phase 4 — Location & Maps
 */
export async function createLiveLocationSession(
  userId: string,
  sharedWithUserIds: string[],
  durationHours: number,
  initialLat: number,
  initialLng: number,
): Promise<string> {
  try {
    const expiresAt = new Date(Date.now() + durationHours * MS_PER_HOUR);
    const created = await addDoc(sessionsCollection(), {
      userId,
      latitude: initialLat,
      longitude: initialLng,
      locationUrl: getLocationUrl(initialLat, initialLng),
      sharedWithUserIds,
      startedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      isActive: true,
    });
    return created.id;
  } catch (error) {
    console.error('createLiveLocationSession failed:', error);
    throw error;
  }
}

/**
 * Pushes a new coordinate into an active session.
 * @phase Phase 4 — Location & Maps
 */
export async function updateLiveLocation(
  sessionId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  try {
    await updateDoc(sessionDoc(sessionId), {
      latitude,
      longitude,
      locationUrl: getLocationUrl(latitude, longitude),
    });
  } catch (error) {
    console.error('updateLiveLocation failed:', error);
    throw error;
  }
}

/**
 * Extends an active session's expiry, capped at `LIVE_LOCATION_MAX_HOURS` from
 * the session's start.
 * @phase Phase 4 — Location & Maps
 */
export async function extendLiveLocationSession(
  sessionId: string,
  additionalHours: number,
): Promise<void> {
  try {
    const snapshot = await getDoc(sessionDoc(sessionId));
    const data = snapshot.data() as Omit<LiveLocationSession, 'id'> | undefined;
    if (data === undefined) throw new Error('Session not found');

    const currentExpiry = data.expiresAt.toDate();
    const requestedExpiry = new Date(currentExpiry.getTime() + additionalHours * MS_PER_HOUR);
    const maxExpiry = new Date(
      data.startedAt.toDate().getTime() + APP_CONFIG.LIVE_LOCATION_MAX_HOURS * MS_PER_HOUR,
    );
    const nextExpiry = requestedExpiry > maxExpiry ? maxExpiry : requestedExpiry;

    await updateDoc(sessionDoc(sessionId), {
      expiresAt: Timestamp.fromDate(nextExpiry),
    });
  } catch (error) {
    console.error('extendLiveLocationSession failed:', error);
    throw error;
  }
}

/**
 * Ends a live-location session.
 * @phase Phase 4 — Location & Maps
 */
export async function stopLiveLocationSession(sessionId: string): Promise<void> {
  try {
    await updateDoc(sessionDoc(sessionId), { isActive: false });
  } catch (error) {
    console.error('stopLiveLocationSession failed:', error);
    throw error;
  }
}

/**
 * Subscribes to a single session document. Returns the unsubscribe function.
 * @phase Phase 4 — Location & Maps
 */
export function subscribeToLiveSession(
  sessionId: string,
  onUpdate: (session: LiveLocationSession) => void,
): () => void {
  return onSnapshot(sessionDoc(sessionId), (snapshot) => {
    if (!snapshot.exists()) return;
    onUpdate({
      id: snapshot.id,
      ...(snapshot.data() as Omit<LiveLocationSession, 'id'>),
    });
  });
}

/**
 * Returns the user's currently active session, or `null` if there is none.
 * @phase Phase 4 — Location & Maps
 */
export async function getActiveLiveSession(userId: string): Promise<LiveLocationSession | null> {
  try {
    const snapshot = await getDocs(
      query(
        sessionsCollection(),
        where('userId', '==', userId),
        where('isActive', '==', true),
        limit(1),
      ),
    );
    const first = snapshot.docs[0];
    if (first === undefined) return null;
    return { id: first.id, ...(first.data() as Omit<LiveLocationSession, 'id'>) };
  } catch (error) {
    console.error('getActiveLiveSession failed:', error);
    throw error;
  }
}
