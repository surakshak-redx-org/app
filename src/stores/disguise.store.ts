import { create } from 'zustand';

interface DisguiseStore {
  /**
   * Whether Disguise Mode is on, mirrored from `DISGUISE_ENABLED` in
   * AsyncStorage. `null` until it has been read at startup — the navigator
   * is held back until then so the real Home tab never flashes first.
   */
  isEnabled: boolean | null;
  isUnlockedThisSession: boolean;
  setEnabled: (enabled: boolean) => void;
  unlock: () => void;
  lock: () => void;
}

/**
 * Tracks Disguise Mode and whether the correct PIN has already been entered
 * during this app session. `DISGUISE_ENABLED` in AsyncStorage must stay on
 * across app restarts so Disguise Mode re-arms on the next cold start, but
 * once unlocked here it must not immediately re-trigger the calculator
 * redirect in the root layout as the user navigates around the real app.
 * `useDisguiseGate` re-locks it after the app has been in the background.
 */
export const useDisguiseStore = create<DisguiseStore>((set) => ({
  isEnabled: null,
  isUnlockedThisSession: false,
  setEnabled: (isEnabled): void => set({ isEnabled }),
  unlock: (): void => set({ isUnlockedThisSession: true }),
  lock: (): void => set({ isUnlockedThisSession: false }),
}));
