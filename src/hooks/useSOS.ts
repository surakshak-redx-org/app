import { useCallback } from 'react';

import { useSOSStore } from '@/stores/sos.store';
import type { SOSTriggerMethod } from '@/types/emergency.types';

export interface UseSOSResult {
  isActive: boolean;
  countdown: number;
  triggerMethod: SOSTriggerMethod | null;
  trigger: (method: SOSTriggerMethod) => void;
  cancel: () => void;
}

/**
 * TODO: Phase 3 — Emergency Core. `trigger` will start the countdown timer,
 * then fan out SMS, siren and recording once it elapses.
 */
export function useSOS(): UseSOSResult {
  const isActive = useSOSStore((state) => state.isActive);
  const countdown = useSOSStore((state) => state.countdown);
  const triggerMethod = useSOSStore((state) => state.triggerMethod);
  const setActive = useSOSStore((state) => state.setActive);
  const reset = useSOSStore((state) => state.reset);

  const trigger = useCallback(
    (method: SOSTriggerMethod): void => {
      setActive(true, method);
    },
    [setActive],
  );

  const cancel = useCallback((): void => {
    reset();
  }, [reset]);

  return { isActive, countdown, triggerMethod, trigger, cancel };
}
