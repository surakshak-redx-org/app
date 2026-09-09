import type { User as FirebaseUser } from '@react-native-firebase/auth';
import { useCallback } from 'react';

import { signOutUser } from '@/services/firebase/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import type { User } from '@/types/user.types';

export interface UseAuthResult {
  user: FirebaseUser | null;
  surakshakUser: User | null;
  isLoading: boolean;
  isGuest: boolean;
  isInitialized: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((state) => state.user);
  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const resetAuth = useAuthStore((state) => state.reset);
  const resetUser = useUserStore((state) => state.reset);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutUser();
    } finally {
      // Clear local state even if the network call failed — leaving a stale
      // profile on screen after a sign-out attempt is worse than a retry.
      resetAuth();
      resetUser();
    }
  }, [resetAuth, resetUser]);

  return { user, surakshakUser, isLoading, isGuest, isInitialized, signOut };
}
