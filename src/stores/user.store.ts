import { create } from 'zustand';

import type { EmergencyContact, User } from '@/types/user.types';

interface UserStore {
  profile: User | null;
  emergencyContacts: EmergencyContact[];
  isLoadingProfile: boolean;
  setProfile: (profile: User | null) => void;
  setEmergencyContacts: (contacts: EmergencyContact[]) => void;
  setLoadingProfile: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  profile: null,
  emergencyContacts: [],
  isLoadingProfile: false,
} as const;

export const useUserStore = create<UserStore>((set) => ({
  ...initialState,
  emergencyContacts: [],
  setProfile: (profile): void => set({ profile }),
  setEmergencyContacts: (emergencyContacts): void => set({ emergencyContacts }),
  setLoadingProfile: (isLoadingProfile): void => set({ isLoadingProfile }),
  reset: (): void => set({ ...initialState, emergencyContacts: [] }),
}));
