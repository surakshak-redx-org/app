import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef } from 'react';

import { trackSirenToggled } from '@/services/analytics.service';
import { useSOSStore } from '@/stores/sos.store';
import SIREN_SOURCE from '@assets/sounds/siren.wav';

export interface UseSirenResult {
  isActive: boolean;
  toggle: () => void;
}

const SIREN_VOLUME = 1;

/**
 * Drives the loud attention siren. State lives in `useSOSStore.isSirenActive`
 * so any screen sees the same on/off. Playback uses `expo-audio` via an
 * imperative player (kept in a ref so the loop flag can be set without
 * mutating a hook return); the screen stays awake while it runs and the siren
 * overrides the mute switch.
 */
export function useSiren(): UseSirenResult {
  const isActive = useSOSStore((state) => state.isSirenActive);
  const setSirenActive = useSOSStore((state) => state.setSirenActive);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    const player = createAudioPlayer(SIREN_SOURCE);
    player.loop = true;
    player.volume = SIREN_VOLUME;
    playerRef.current = player;

    return (): void => {
      player.pause();
      player.remove();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (player === null) return;

    if (isActive) {
      void setAudioModeAsync({ playsInSilentMode: true });
      player.play();
      void activateKeepAwakeAsync();
    } else {
      player.pause();
      void deactivateKeepAwake();
    }
  }, [isActive]);

  const toggle = useCallback((): void => {
    const next = !useSOSStore.getState().isSirenActive;
    setSirenActive(next);
    trackSirenToggled(next);
  }, [setSirenActive]);

  return { isActive, toggle };
}
