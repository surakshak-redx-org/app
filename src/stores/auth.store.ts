import type { User as FirebaseUser } from '@react-native-firebase/auth';
import { create } from 'zustand';

import type { User } from '@/types/user.types';

interface AuthStore {
  /** The raw Firebase credential. `null` until signed in. */
  user: FirebaseUser | null;
  /** The Firestore profile document for that credential. */
  surakshakUser: User | null;
  isLoading: boolean;
  isGuest: boolean;
  /**
   * True while a guest has deliberately opened the (auth) group to convert
   * to a real account (GuestBanner's "Sign In Now"). The root layout treats
   * `isGuest` as "signed in" so a guest isn't bounced to Welcome on every
   * launch — but that same check would otherwise immediately bounce this
   * screen back to Home the instant it navigates into (auth), since a guest
   * still reads as "signed in". This flag is the one-off override for that
   * specific, deliberate navigation. Cleared once a real Firebase user signs
   * in.
   */
  isGuestSigningIn: boolean;
  /** False until the first `onAuthStateChanged` callback has fired. */
  isInitialized: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setSurakshakUser: (user: User | null) => void;
  setGuest: (isGuest: boolean) => void;
  setGuestSigningIn: (isGuestSigningIn: boolean) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  surakshakUser: null,
  isLoading: false,
  isGuest: false,
  isGuestSigningIn: false,
  isInitialized: false,
} as const;

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,
  setUser: (user): void => set({ user }),
  setSurakshakUser: (surakshakUser): void => set({ surakshakUser }),
  setGuest: (isGuest): void => set({ isGuest }),
  setGuestSigningIn: (isGuestSigningIn): void => set({ isGuestSigningIn }),
  setLoading: (isLoading): void => set({ isLoading }),
  setInitialized: (isInitialized): void => set({ isInitialized }),
  reset: (): void => set({ ...initialState }),
}));
