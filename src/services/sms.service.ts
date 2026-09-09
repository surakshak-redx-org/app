import type { SMSAlertResult } from '@/types/emergency.types';
import type { EmergencyContact } from '@/types/user.types';

/**
 * Sends the SOS alert to every emergency contact over the device SIM.
 * @phase Phase 3 — Emergency Core
 */
export function sendSOSAlert(
  _contacts: EmergencyContact[],
  _message: string,
): Promise<SMSAlertResult> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}

/**
 * Sends the low-battery warning to every emergency contact.
 * @phase Phase 7 — Advanced Safety
 */
export function sendLowBatteryAlert(
  _contacts: EmergencyContact[],
  _message: string,
): Promise<SMSAlertResult> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Reports whether the device can send SMS at all (tablets often cannot).
 * @phase Phase 3 — Emergency Core
 */
export function isSMSAvailable(): Promise<boolean> {
  return Promise.reject(new Error('Not implemented — Phase 3'));
}
