import { create } from 'zustand';

interface DisguiseStore {
  isUnlockedThisSession: boolean;
  unlock: () => void;
  lock: () => void;
}

/**
 * Tracks whether the correct disguise PIN has already been entered during
 * this app session. `DISGUISE_ENABLED` in AsyncStorage must stay on across
 * app restarts so Disguise Mode re-arms on the next cold start, but once
 * unlocked here it must not immediately re-trigger the calculator redirect
 * in the root layout as the user navigates around the real app.
 */
export const useDisguiseStore = create<DisguiseStore>((set) => ({
  isUnlockedThisSession: false,
  unlock: (): void => set({ isUnlockedThisSession: true }),
  lock: (): void => set({ isUnlockedThisSession: false }),
}));
