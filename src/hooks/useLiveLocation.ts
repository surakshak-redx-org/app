import { useCallback } from 'react';

import { useLocationStore } from '@/stores/location.store';

export interface UseLiveLocationResult {
  isActive: boolean;
  sessionId: string | null;
  startSharing: (contactIds: string[], durationHours: number) => Promise<void>;
  stopSharing: () => Promise<void>;
  extendTime: (additionalHours: number) => Promise<void>;
}

/** TODO: Phase 4 — Location & Maps. */
export function useLiveLocation(): UseLiveLocationResult {
  const isActive = useLocationStore((state) => state.isLiveLocationActive);
  const sessionId = useLocationStore((state) => state.liveLocationSessionId);

  const startSharing = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 4'));
  }, []);

  const stopSharing = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 4'));
  }, []);

  const extendTime = useCallback((): Promise<void> => {
    return Promise.reject(new Error('Not implemented — Phase 4'));
  }, []);

  return { isActive, sessionId, startSharing, stopSharing, extendTime };
}
