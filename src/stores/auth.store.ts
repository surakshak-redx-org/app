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
  /** False until the first `onAuthStateChanged` callback has fired. */
  isInitialized: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setSurakshakUser: (user: User | null) => void;
  setGuest: (isGuest: boolean) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  surakshakUser: null,
  isLoading: false,
  isGuest: false,
  isInitialized: false,
} as const;

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,
  setUser: (user): void => set({ user }),
  setSurakshakUser: (surakshakUser): void => set({ surakshakUser }),
  setGuest: (isGuest): void => set({ isGuest }),
  setLoading: (isLoading): void => set({ isLoading }),
  setInitialized: (isInitialized): void => set({ isInitialized }),
  reset: (): void => set({ ...initialState }),
}));
