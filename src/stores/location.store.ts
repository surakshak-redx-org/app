import { create } from 'zustand';

import type { LiveTrackingProfile, LocationData, UnsafeArea } from '@/types/location.types';

interface LocationStore {
  currentLocation: LocationData | null;
  locationPermissionGranted: boolean;
  isLiveLocationActive: boolean;
  liveLocationSessionId: string | null;
  /** Sampling profile of the running live-location session; `null` when none. */
  liveTrackingProfile: LiveTrackingProfile | null;
  /** Latest battery reading (0–1) taken while sharing; `null` when unknown. */
  liveBatteryLevel: number | null;
  isSafeJourneyActive: boolean;
  safeJourneySessionId: string | null;
  /** Bumped whenever a journey's deadline changes, so the app-wide monitor re-reads it. */
  safeJourneyRevision: number;
  cachedUnsafeAreas: UnsafeArea[];
  isNearbyHelpRequested: boolean;
  setCurrentLocation: (location: LocationData) => void;
  setLocationPermission: (granted: boolean) => void;
  setLiveLocationActive: (active: boolean, sessionId?: string) => void;
  setLiveTrackingStatus: (profile: LiveTrackingProfile, batteryLevel: number | null) => void;
  setSafeJourneyActive: (active: boolean, sessionId?: string) => void;
  bumpSafeJourneyRevision: () => void;
  setCachedUnsafeAreas: (areas: UnsafeArea[]) => void;
  requestNearbyHelp: () => void;
  clearNearbyHelpRequest: () => void;
  reset: () => void;
}

const initialState = {
  currentLocation: null,
  locationPermissionGranted: false,
  isLiveLocationActive: false,
  liveLocationSessionId: null,
  liveTrackingProfile: null,
  liveBatteryLevel: null,
  isSafeJourneyActive: false,
  safeJourneySessionId: null,
  safeJourneyRevision: 0,
  cachedUnsafeAreas: [] as UnsafeArea[],
  isNearbyHelpRequested: false,
};

export const useLocationStore = create<LocationStore>((set) => ({
  ...initialState,
  setCurrentLocation: (currentLocation): void => set({ currentLocation }),
  setLocationPermission: (locationPermissionGranted): void => set({ locationPermissionGranted }),
  setLiveLocationActive: (active, sessionId): void =>
    set({
      isLiveLocationActive: active,
      liveLocationSessionId: active ? (sessionId ?? null) : null,
      ...(active ? {} : { liveTrackingProfile: null, liveBatteryLevel: null }),
    }),
  setLiveTrackingStatus: (liveTrackingProfile, liveBatteryLevel): void =>
    set({ liveTrackingProfile, liveBatteryLevel }),
  setSafeJourneyActive: (active, sessionId): void =>
    set({
      isSafeJourneyActive: active,
      safeJourneySessionId: active ? (sessionId ?? null) : null,
    }),
  bumpSafeJourneyRevision: (): void =>
    set((state) => ({ safeJourneyRevision: state.safeJourneyRevision + 1 })),
  setCachedUnsafeAreas: (cachedUnsafeAreas): void => set({ cachedUnsafeAreas }),
  requestNearbyHelp: (): void => set({ isNearbyHelpRequested: true }),
  clearNearbyHelpRequest: (): void => set({ isNearbyHelpRequested: false }),
  reset: (): void => set({ ...initialState, cachedUnsafeAreas: [] }),
}));
