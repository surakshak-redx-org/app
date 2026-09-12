/** How a message/call actually left the device. */
export type SendMethod = 'direct' | 'compose_sheet';
export type CallMethod = 'direct' | 'dialer';

export interface SendSmsResult {
  success: boolean;
  phone: string;
  error?: string;
  method: SendMethod;
}

export interface CallResult {
  success: boolean;
  phone: string;
  method: CallMethod;
}
