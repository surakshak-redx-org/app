import { useState } from 'react';

import { APP_CONFIG } from '@/constants/config';

export interface UseBatteryAlertResult {
  batteryLevel: number;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  threshold: number;
  setThreshold: (threshold: number) => void;
}

/**
 * TODO: Phase 7 — Advanced Safety. Will watch `expo-battery` and fire the
 * low-battery SMS once, on the downward crossing of the threshold.
 */
export function useBatteryAlert(): UseBatteryAlertResult {
  const [batteryLevel] = useState<number>(1);
  const [isEnabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(APP_CONFIG.LOW_BATTERY_THRESHOLD_PERCENT);

  return { batteryLevel, isEnabled, setEnabled, threshold, setThreshold };
}
