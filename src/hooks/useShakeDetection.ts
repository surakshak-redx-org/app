import { useState } from 'react';

export interface UseShakeDetectionResult {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * TODO: Phase 7 — Advanced Safety. Will subscribe to the accelerometer and
 * fire the SOS trigger after SHAKE_COUNT_REQUIRED shakes inside SHAKE_WINDOW_MS.
 */
export function useShakeDetection(): UseShakeDetectionResult {
  const [isEnabled, setEnabled] = useState(false);

  return { isEnabled, setEnabled };
}
