import { create } from 'zustand';

import type { LocationData } from '@/types/location.types';

interface LocationStore {
  currentLocation: LocationData | null;
  locationPermissionGranted: boolean;
  isLiveLocationActive: boolean;
  liveLocationSessionId: string | null;
  isSafeJourneyActive: boolean;
  safeJourneySessionId: string | null;
  setCurrentLocation: (location: LocationData) => void;
  setLocationPermission: (granted: boolean) => void;
  setLiveLocationActive: (active: boolean, sessionId?: string) => void;
  setSafeJourneyActive: (active: boolean, sessionId?: string) => void;
  reset: () => void;
}

const initialState = {
  currentLocation: null,
  locationPermissionGranted: false,
  isLiveLocationActive: false,
  liveLocationSessionId: null,
  isSafeJourneyActive: false,
  safeJourneySessionId: null,
} as const;

export const useLocationStore = create<LocationStore>((set) => ({
  ...initialState,
  setCurrentLocation: (currentLocation): void => set({ currentLocation }),
  setLocationPermission: (locationPermissionGranted): void => set({ locationPermissionGranted }),
  setLiveLocationActive: (active, sessionId): void =>
    set({
      isLiveLocationActive: active,
      liveLocationSessionId: active ? (sessionId ?? null) : null,
    }),
  setSafeJourneyActive: (active, sessionId): void =>
    set({
      isSafeJourneyActive: active,
      safeJourneySessionId: active ? (sessionId ?? null) : null,
    }),
  reset: (): void => set({ ...initialState }),
}));
