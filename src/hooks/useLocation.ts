import { useCallback } from 'react';

import { useLocationStore } from '@/stores/location.store';
import type { LocationData } from '@/types/location.types';
import { getLocationUrl } from '@/utils/location.utils';

export interface UseLocationResult {
  currentLocation: LocationData | null;
  locationPermissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  getLocationUrl: () => string | null;
}

/**
 * TODO: Phase 4 — Location & Maps. `requestPermission` will wire through to
 * `permissions.utils` and start the position watch.
 */
export function useLocation(): UseLocationResult {
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const locationPermissionGranted = useLocationStore((state) => state.locationPermissionGranted);

  const requestPermission = useCallback((): Promise<boolean> => {
    return Promise.resolve(false);
  }, []);

  const buildLocationUrl = useCallback((): string | null => {
    if (currentLocation === null) return null;
    return getLocationUrl(currentLocation.latitude, currentLocation.longitude);
  }, [currentLocation]);

  return {
    currentLocation,
    locationPermissionGranted,
    requestPermission,
    getLocationUrl: buildLocationUrl,
  };
}
