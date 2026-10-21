import { Asset } from 'expo-asset';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { startSiren, stopSiren } from 'surakshak-native';

import { KEEP_AWAKE_TAGS } from '@/constants/ui';
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
 * imperative player, with Android native alarm stream escalation when available.
 * The screen stays awake while it runs and the siren overrides the mute switch.
 */
export function useSiren(): UseSirenResult {
  const isActive = useSOSStore((state) => state.isSirenActive);
  const setSirenActive = useSOSStore((state) => state.setSirenActive);
  const playerRef = useRef<AudioPlayer | null>(null);
  const nativeSirenActiveRef = useRef(false);

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
    const isAndroid = Platform.OS === 'android';
    const player = playerRef.current;
    let cancelled = false;

    const playSiren = async (): Promise<void> => {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
      if (cancelled) return;

      let startedNative = false;
      if (isAndroid) {
        try {
          const asset = Asset.fromModule(SIREN_SOURCE);
          if (!asset.localUri) {
            await asset.downloadAsync();
          }
          if (!cancelled && asset.localUri) {
            startedNative = await startSiren(asset.localUri);
          }
        } catch (error) {
          console.warn('Native siren start failed, falling back to expo-audio:', error);
        }
      }

      nativeSirenActiveRef.current = startedNative;

      if (cancelled) {
        if (startedNative) {
          await stopSiren();
        }
        return;
      }

      if (!startedNative && player !== null) {
        player.play();
      }
    };

    if (isActive) {
      void playSiren();
      void activateKeepAwakeAsync(KEEP_AWAKE_TAGS.SIREN);
    } else {
      if (isAndroid || nativeSirenActiveRef.current) {
        void stopSiren();
        nativeSirenActiveRef.current = false;
      }
      player?.pause();
      void deactivateKeepAwake(KEEP_AWAKE_TAGS.SIREN);
    }

    return (): void => {
      cancelled = true;
    };
  }, [isActive]);

  const toggle = useCallback((): void => {
    const next = !useSOSStore.getState().isSirenActive;
    setSirenActive(next);
    trackSirenToggled(next);
  }, [setSirenActive]);

  return { isActive, toggle };
}
