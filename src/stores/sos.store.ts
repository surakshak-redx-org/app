import { create } from 'zustand';

import { APP_CONFIG } from '@/constants/config';
import type { SOSTriggerMethod } from '@/types/emergency.types';

interface SOSStore {
  isActive: boolean;
  countdown: number;
  triggerMethod: SOSTriggerMethod | null;
  isSirenActive: boolean;
  isRecording: boolean;
  setActive: (active: boolean, method?: SOSTriggerMethod) => void;
  setCountdown: (count: number) => void;
  setSirenActive: (active: boolean) => void;
  setRecording: (recording: boolean) => void;
  reset: () => void;
}

const initialState = {
  isActive: false,
  countdown: APP_CONFIG.SOS_COUNTDOWN_SECONDS,
  triggerMethod: null,
  isSirenActive: false,
  isRecording: false,
} as const;

export const useSOSStore = create<SOSStore>((set) => ({
  ...initialState,
  setActive: (active, method): void =>
    set({
      isActive: active,
      triggerMethod: active ? (method ?? null) : null,
      countdown: active ? APP_CONFIG.SOS_COUNTDOWN_SECONDS : initialState.countdown,
    }),
  setCountdown: (countdown): void => set({ countdown }),
  setSirenActive: (isSirenActive): void => set({ isSirenActive }),
  setRecording: (isRecording): void => set({ isRecording }),
  reset: (): void => set({ ...initialState }),
}));
