import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';

import { SMS_HISTORY_LIMIT } from '@/constants/config';
import { STORAGE_KEYS } from '@/constants/storage';
import type { SMSAlertRecord, SMSAlertResult } from '@/types/emergency.types';
import type { EmergencyContact, Language } from '@/types/user.types';
import { formatIndianPhone, validateIndianPhone } from '@/utils/phone.utils';
import {
  buildCheckInMissedMessage,
  buildLowBatteryMessage,
  buildSafeJourneyMessage,
  buildSOSMessage,
} from '@/utils/sms.utils';

/**
 * SMS is sent over the device SIM. There is a hard platform split:
 *  - iOS opens the system compose sheet pre-filled; the user taps send once.
 *  - Android sends silently in the background with no compose UI.
 * `expo-sms` never reports per-recipient delivery, and on Android always
 * resolves `{ result: 'unknown' }`, so a send is treated as all-or-nothing:
 * anything other than an explicit `'cancelled'` counts as sent.
 */

/** Reports whether the device can send SMS at all (most tablets cannot). */
export async function isSMSAvailable(): Promise<boolean> {
  try {
    return await SMS.isAvailableAsync();
  } catch (error) {
    console.error('isSMSAvailable failed:', error);
    throw error;
  }
}

/** Custom contacts with a dialable Indian mobile number, normalised to E.164. */
function resolveRecipients(contacts: EmergencyContact[]): string[] {
  return contacts
    .filter((contact) => !contact.isPredefined && validateIndianPhone(contact.phone))
    .map((contact) => formatIndianPhone(contact.phone));
}

async function dispatch(recipients: string[], message: string): Promise<SMSAlertResult> {
  if (recipients.length === 0) return { sent: [], failed: [] };

  try {
    const available = await SMS.isAvailableAsync();
    if (!available) return { sent: [], failed: recipients };

    const { result } = await SMS.sendSMSAsync(recipients, message);
    return result === 'cancelled'
      ? { sent: [], failed: recipients }
      : { sent: recipients, failed: [] };
  } catch (error) {
    // A fan-out must never throw back into the SOS flow — record the failure
    // and let the caller persist / surface it.
    console.error('sms dispatch failed:', error);
    return { sent: [], failed: recipients };
  }
}

export async function sendSOSAlert(
  contacts: EmergencyContact[],
  locationUrl: string,
  userName: string,
  language: Language,
): Promise<SMSAlertResult> {
  return dispatch(resolveRecipients(contacts), buildSOSMessage(userName, locationUrl, language));
}

export async function sendLowBatteryAlert(
  contacts: EmergencyContact[],
  locationUrl: string,
  userName: string,
  language: Language,
): Promise<SMSAlertResult> {
  return dispatch(
    resolveRecipients(contacts),
    buildLowBatteryMessage(userName, locationUrl, language),
  );
}

export async function sendSafeJourneyAlert(
  contacts: EmergencyContact[],
  locationUrl: string,
  userName: string,
  destination: string,
  etaTime: string,
  language: Language,
): Promise<SMSAlertResult> {
  return dispatch(
    resolveRecipients(contacts),
    buildSafeJourneyMessage(userName, destination, etaTime, language),
  );
}

export async function sendCheckInMissedAlert(
  contacts: EmergencyContact[],
  locationUrl: string,
  userName: string,
  language: Language,
): Promise<SMSAlertResult> {
  return dispatch(
    resolveRecipients(contacts),
    buildCheckInMissedMessage(userName, locationUrl, language),
  );
}

/**
 * Shares a silent-recording evidence link with the user's own emergency
 * contacts. Unlike the alert senders above this isn't tied to a fixed
 * template language lookup — the link itself carries all the information a
 * recipient needs, so the message is a short, direct sentence.
 */
export async function sendEvidenceLinkAlert(
  contacts: EmergencyContact[],
  evidenceUrl: string,
): Promise<SMSAlertResult> {
  return dispatch(resolveRecipients(contacts), `Evidence recording from Surakshak: ${evidenceUrl}`);
}

/* -------------------------- alert history -------------------------- */

export async function getSMSAlertHistory(): Promise<SMSAlertRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SMS_HISTORY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SMSAlertRecord[]) : [];
  } catch (error) {
    console.warn('getSMSAlertHistory: could not read history:', error);
    return [];
  }
}

export async function recordSMSAlert(
  input: Pick<SMSAlertRecord, 'type' | 'locationUrl' | 'contactsSent' | 'contactsFailed'>,
): Promise<SMSAlertRecord> {
  try {
    const record: SMSAlertRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...input,
    };
    const history = await getSMSAlertHistory();
    const next = [record, ...history].slice(0, SMS_HISTORY_LIMIT);
    await AsyncStorage.setItem(STORAGE_KEYS.SMS_HISTORY, JSON.stringify(next));
    return record;
  } catch (error) {
    console.error('recordSMSAlert failed:', error);
    throw error;
  }
}

export async function clearSMSAlertHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SMS_HISTORY);
  } catch (error) {
    console.error('clearSMSAlertHistory failed:', error);
    throw error;
  }
}
