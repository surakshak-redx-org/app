import { act, renderHook } from '@testing-library/react-native';

import { useSiren } from '@/hooks/useSiren';
import * as analytics from '@/services/analytics.service';
import { useSOSStore } from '@/stores/sos.store';

const mockPlayer = { play: jest.fn(), pause: jest.fn(), remove: jest.fn(), loop: false, volume: 0 };

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/analytics.service', () => ({ trackSirenToggled: jest.fn() }));

describe('useSiren', () => {
  beforeEach(() => {
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    jest.mocked(analytics.trackSirenToggled).mockClear();
    useSOSStore.getState().reset();
  });

  it('starts inactive and plays the looping siren when toggled on', async () => {
    const { result } = await renderHook(() => useSiren());
    expect(result.current.isActive).toBe(false);
    expect(mockPlayer.loop).toBe(true);

    await act(() => {
      result.current.toggle();
    });

    expect(useSOSStore.getState().isSirenActive).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(analytics.trackSirenToggled).toHaveBeenCalledWith(true);
  });

  it('pauses the siren when toggled back off', async () => {
    const { result } = await renderHook(() => useSiren());

    await act(() => {
      result.current.toggle();
    });
    await act(() => {
      result.current.toggle();
    });

    expect(useSOSStore.getState().isSirenActive).toBe(false);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(analytics.trackSirenToggled).toHaveBeenLastCalledWith(false);
  });
});
