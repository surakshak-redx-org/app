import AsyncStorage from '@react-native-async-storage/async-storage';

import { EVIDENCE_RECORDING_HISTORY_LIMIT } from '@/constants/config';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * A local index of a user's own past evidence-recording uploads. The
 * recording itself already lives durably in Firebase Storage once uploaded
 * (see `uploadEvidenceRecording` in `firebase/incident.service.ts`) — this is
 * only a device-local record so "My Recordings" has something to list. It is
 * NOT synced to Firestore, so it won't follow the user to another device and
 * clearing app storage clears it, same tradeoff as the SMS alert history.
 */
export interface EvidenceRecordingRecord {
  id: string;
  /** The Firebase Storage download URL from `uploadEvidenceRecording`. */
  url: string;
  durationSeconds: number;
  /** `Date.now()` at the time the upload finished. */
  createdAt: number;
}

export async function getEvidenceRecordings(): Promise<EvidenceRecordingRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.EVIDENCE_RECORDING_HISTORY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EvidenceRecordingRecord[]) : [];
  } catch (error) {
    console.warn('getEvidenceRecordings: could not read history:', error);
    return [];
  }
}

export async function recordEvidenceUpload(
  input: Pick<EvidenceRecordingRecord, 'url' | 'durationSeconds'>,
): Promise<EvidenceRecordingRecord> {
  try {
    const record: EvidenceRecordingRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      ...input,
    };
    const history = await getEvidenceRecordings();
    const next = [record, ...history].slice(0, EVIDENCE_RECORDING_HISTORY_LIMIT);
    await AsyncStorage.setItem(STORAGE_KEYS.EVIDENCE_RECORDING_HISTORY, JSON.stringify(next));
    return record;
  } catch (error) {
    console.error('recordEvidenceUpload failed:', error);
    throw error;
  }
}

export async function clearEvidenceRecordingHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.EVIDENCE_RECORDING_HISTORY);
  } catch (error) {
    console.error('clearEvidenceRecordingHistory failed:', error);
    throw error;
  }
}
