import { renderHook } from '@testing-library/react-native';

import { useShakeDetection } from '@/hooks/useShakeDetection';

type AccelListener = (reading: { x: number; y: number; z: number }) => void;

const mockRemove = jest.fn();
let mockAddListenerCount = 0;
let mockCapturedListener: AccelListener | undefined;

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((listener: AccelListener) => {
      mockAddListenerCount += 1;
      mockCapturedListener = listener;
      return { remove: mockRemove };
    }),
  },
}));

// The hook never calls React setState from the accelerometer callback (it just
// invokes the caller's `onShake`), so these reading pushes need no `act`.
const HARD_SHAKE = { x: 3, y: 3, z: 3 }; // magnitude ~5.2 > threshold 2.5
const STILL = { x: 0, y: 0, z: 0 };

describe('useShakeDetection', () => {
  beforeEach(() => {
    mockRemove.mockClear();
    mockAddListenerCount = 0;
    mockCapturedListener = undefined;
  });

  it('fires onShake after three hard shakes inside the window', async () => {
    const onShake = jest.fn();
    await renderHook(() => useShakeDetection(onShake, true));

    mockCapturedListener!(HARD_SHAKE);
    mockCapturedListener!(HARD_SHAKE);
    expect(onShake).not.toHaveBeenCalled();
    mockCapturedListener!(HARD_SHAKE);
    expect(onShake).toHaveBeenCalledTimes(1);
  });

  it('ignores readings below the threshold', async () => {
    const onShake = jest.fn();
    await renderHook(() => useShakeDetection(onShake, true));

    mockCapturedListener!(STILL);
    mockCapturedListener!(STILL);
    mockCapturedListener!(STILL);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('does not subscribe while disabled', async () => {
    await renderHook(() => useShakeDetection(jest.fn(), false));
    expect(mockAddListenerCount).toBe(0);
  });

  it('removes the subscription on unmount', async () => {
    const view = await renderHook(() => useShakeDetection(jest.fn(), true));
    expect(mockAddListenerCount).toBe(1);

    await view.unmount();

    expect(mockRemove).toHaveBeenCalled();
  });
});
