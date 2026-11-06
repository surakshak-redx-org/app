import {
  Timestamp,
  addDoc,
  deleteField,
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
  writeBatch,
} from '@react-native-firebase/firestore';

import { firestore } from '@/config/firebase';
import { APP_CONFIG } from '@/constants/config';
import type { LiveLocationSession, LiveLocationTelemetry } from '@/types/location.types';
import { getLocationUrl } from '@/utils/location.utils';

const SESSIONS_COLLECTION = 'liveLocationSessions';
const POINTS_SUBCOLLECTION = 'points';
const MS_PER_HOUR = 60 * 60 * 1000;

function sessionsCollection(): ReturnType<typeof collection> {
  return collection(firestore, SESSIONS_COLLECTION);
}

function sessionDoc(sessionId: string): ReturnType<typeof doc> {
  return doc(firestore, SESSIONS_COLLECTION, sessionId);
}

/** Drops `undefined` fields; Firestore rejects them. */
function definedOnly(telemetry: LiveLocationTelemetry): Record<string, number | boolean | string> {
  return Object.fromEntries(
    Object.entries(telemetry).filter((entry): entry is [string, number | boolean | string] => {
      return entry[1] !== undefined;
    }),
  );
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
  deviceId?: string,
  shareToken?: string,
): Promise<string> {
  try {
    // BUG-136: Deactivate any other active live location sessions for this user
    // to prevent dual-device logins or multiple concurrent sessions from overwriting each other.
    try {
      const activeExisting = await getDocs(
        query(sessionsCollection(), where('userId', '==', userId), where('isActive', '==', true)),
      );
      await Promise.all(
        activeExisting.docs.map((docSnap) =>
          updateDoc(docSnap.ref, { isActive: false, status: 'ended' }).catch(() => undefined),
        ),
      );
    } catch (cleanupError) {
      console.warn('createLiveLocationSession: could not cleanup old sessions:', cleanupError);
    }

    const expiresAt = new Date(Date.now() + durationHours * MS_PER_HOUR);
    const sessionPayload: Record<string, unknown> = {
      userId,
      latitude: initialLat,
      longitude: initialLng,
      locationUrl: getLocationUrl(initialLat, initialLng),
      sharedWithUserIds,
      startedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      isActive: true,
      status: 'active',
      lastFixAt: serverTimestamp(),
    };
    if (shareToken !== undefined) {
      sessionPayload.shareToken = shareToken;
    }
    if (deviceId !== undefined) {
      sessionPayload.deviceId = deviceId;
    }

    const created = await addDoc(sessionsCollection(), sessionPayload);
    return created.id;
  } catch (error) {
    console.error('createLiveLocationSession failed:', error);
    throw error;
  }
}

/**
 * Pushes a new coordinate into an active session and, when `appendPoint` is
 * set, records it on the route trail — both in one atomic batch.
 *
 * There is deliberately no read-before-write: that cost a Firestore read on
 * every fix and failed offline. Ownership is enforced by Firestore rules, and
 * only the device that created the session holds its id locally.
 * @phase Phase 4 — Location & Maps
 */
export async function updateLiveLocation(
  sessionId: string,
  latitude: number,
  longitude: number,
  appendPoint: boolean,
  telemetry: LiveLocationTelemetry = {},
): Promise<void> {
  try {
    const sessionRef = sessionDoc(sessionId);
    const batch = writeBatch(firestore);
    batch.update(sessionRef, {
      latitude,
      longitude,
      locationUrl: getLocationUrl(latitude, longitude),
      lastFixAt: serverTimestamp(),
      // A fix means the sender is reachable again, which clears a server-set
      // `lost_contact`. Firestore rejects `undefined`, so absent readings are dropped.
      status: 'active',
      ...definedOnly(telemetry),
    });
    if (appendPoint) {
      batch.set(doc(collection(sessionRef, POINTS_SUBCOLLECTION)), {
        latitude,
        longitude,
        recordedAt: serverTimestamp(),
      });
    }
    await batch.commit();
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
    await updateDoc(sessionDoc(sessionId), { isActive: false, status: 'ended' });
  } catch (error) {
    console.error('stopLiveLocationSession failed:', error);
    throw error;
  }
}

/**
 * Revokes the public tracking link: the token is removed so the web page can no
 * longer resolve the session, while the session itself keeps running.
 * @phase Phase 4 — Location & Maps
 */
export async function revokeShareToken(sessionId: string): Promise<void> {
  try {
    await updateDoc(sessionDoc(sessionId), { shareToken: deleteField() });
  } catch (error) {
    console.error('revokeShareToken failed:', error);
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
