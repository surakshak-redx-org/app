import { create } from 'zustand';

import { APP_CONFIG } from '@/constants/config';
import type { SOSTriggerMethod } from '@/types/emergency.types';

/** Outcome of the last SOS fan-out, surfaced once on the dashboard. */
export interface SOSSendOutcome {
  sent: number;
  failed: number;
  error?: 'failed' | 'no_contacts' | null;
}

interface SOSStore {
  isActive: boolean;
  countdown: number;
  /** Countdown has elapsed and the SMS fan-out is in flight — no longer cancellable. */
  isSending: boolean;
  /** SOS session (siren, live tracking) is running after dispatch. Survives reset(). */
  isSessionActive: boolean;
  lastOutcome: SOSSendOutcome | null;
  triggerMethod: SOSTriggerMethod | null;
  isSirenActive: boolean;
  isRecording: boolean;
  setActive: (active: boolean, method?: SOSTriggerMethod) => void;
  setCountdown: (count: number) => void;
  setSending: (sending: boolean) => void;
  setSessionActive: (active: boolean) => void;
  setLastOutcome: (outcome: SOSSendOutcome | null) => void;
  setSirenActive: (active: boolean) => void;
  setRecording: (recording: boolean) => void;
  reset: () => void;
}

// `isSessionActive` is deliberately NOT here, so reset() never clears it.
const initialState = {
  isActive: false,
  countdown: APP_CONFIG.SOS_COUNTDOWN_SECONDS,
  isSending: false,
  triggerMethod: null,
  isSirenActive: false,
  isRecording: false,
} as const;

export const useSOSStore = create<SOSStore>((set) => ({
  ...initialState,
  isSessionActive: false,
  lastOutcome: null,
  setActive: (active, method): void =>
    set({
      isActive: active,
      triggerMethod: active ? (method ?? null) : null,
      countdown: active ? APP_CONFIG.SOS_COUNTDOWN_SECONDS : initialState.countdown,
    }),
  setCountdown: (countdown): void => set({ countdown }),
  setSending: (isSending): void => set({ isSending }),
  setSessionActive: (isSessionActive): void => set({ isSessionActive }),
  setLastOutcome: (lastOutcome): void => set({ lastOutcome }),
  setSirenActive: (isSirenActive): void => set({ isSirenActive }),
  setRecording: (isRecording): void => set({ isRecording }),
  // Deliberately leaves `lastOutcome` alone: the fan-out resets the SOS
  // lifecycle and records its outcome in the same breath, and the dashboard
  // clears the outcome itself once shown. A running SOS session keeps its
  // siren; only endSosSession() turns it off.
  reset: (): void =>
    set((state) => ({
      ...initialState,
      isSirenActive: state.isSessionActive ? state.isSirenActive : false,
    })),
}));
