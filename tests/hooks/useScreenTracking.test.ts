import { renderHook } from '@testing-library/react-native';
import { useSegments } from 'expo-router';

import { useScreenTracking } from '@/hooks/useScreenTracking';
import { trackScreenViewed } from '@/services/analytics.service';

jest.mock('expo-router', () => ({
  useSegments: jest.fn(),
}));

jest.mock('@/services/analytics.service', () => ({
  trackScreenViewed: jest.fn(),
}));

const mockedUseSegments = jest.mocked(useSegments);

function setSegments(segments: string[]): void {
  // expo-router types segments as a branded tuple; a plain array is what it returns at runtime.
  mockedUseSegments.mockReturnValue(segments as unknown as ReturnType<typeof useSegments>);
}

describe('useScreenTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the route template, not the concrete id', async () => {
    setSegments(['law', '[id]']);
    await renderHook(() => useScreenTracking());

    expect(trackScreenViewed).toHaveBeenCalledWith('law/[id]');
  });

  it('reports grouped routes with their group', async () => {
    setSegments(['(tabs)', 'map']);
    await renderHook(() => useScreenTracking());

    expect(trackScreenViewed).toHaveBeenCalledWith('(tabs)/map');
  });

  it('names the root route when there are no segments', async () => {
    setSegments([]);
    await renderHook(() => useScreenTracking());

    expect(trackScreenViewed).toHaveBeenCalledWith('root');
  });

  it('reports each new screen once and ignores a re-render on the same one', async () => {
    setSegments(['(tabs)', 'map']);
    const { rerender } = await renderHook(() => useScreenTracking());
    await rerender({});
    expect(trackScreenViewed).toHaveBeenCalledTimes(1);

    setSegments(['(tabs)', 'community']);
    await rerender({});
    expect(trackScreenViewed).toHaveBeenCalledTimes(2);
    expect(trackScreenViewed).toHaveBeenLastCalledWith('(tabs)/community');
  });

  it('never reports the disguise calculator', async () => {
    setSegments(['(disguise)', 'calculator']);
    await renderHook(() => useScreenTracking());

    expect(trackScreenViewed).not.toHaveBeenCalled();
  });

  it('resumes reporting after leaving the disguise group', async () => {
    setSegments(['(disguise)', 'calculator']);
    const { rerender } = await renderHook(() => useScreenTracking());

    setSegments(['(tabs)']);
    await rerender({});

    expect(trackScreenViewed).toHaveBeenCalledTimes(1);
    expect(trackScreenViewed).toHaveBeenCalledWith('(tabs)');
  });
});
