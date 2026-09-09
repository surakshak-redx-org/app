export type SOSTriggerMethod = 'button' | 'shake' | 'volume';

export interface SOSState {
  isActive: boolean;
  countdown: number;
  triggerMethod: SOSTriggerMethod | null;
  isSirenActive: boolean;
  isRecording: boolean;
}

export interface SMSAlertResult {
  sent: string[];
  failed: string[];
}

export type SMSAlertType = 'sos' | 'low_battery' | 'safe_journey';

export interface SMSAlertRecord {
  id: string;
  timestamp: number;
  contactsSent: string[];
  contactsFailed: string[];
  type: SMSAlertType;
  locationUrl: string;
}
