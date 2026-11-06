import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { STORAGE_KEYS } from '@/constants/storage';
import {
  stopLiveLocationSession,
  updateLiveLocation,
} from '@/services/firebase/live-location.service';
import {
  processLiveFix,
  registerLiveLocationTask,
  resetTrail,
} from '@/services/live-tracking.task';
import { useLocationStore } from '@/stores/location.store';

jest.mock('@/services/analytics.service', () => ({
  trackLiveLocationExpired: jest.fn(),
}));

jest.mock('@/services/firebase/live-location.service', () => ({
  stopLiveLocationSession: jest.fn(() => Promise.resolve()),
  updateLiveLocation: jest.fn(() => Promise.resolve()),
}));

type TaskBody = { data?: unknown; error?: unknown };
type TaskCallback = (body: TaskBody) => Promise<void>;

function storageWith(values: Record<string, string>): void {
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation((key: string) => Promise.resolve(values[key] ?? null));
}

const ACTIVE_SESSION = {
  [STORAGE_KEYS.LIVE_LOCATION_SESSION_ID]: 'session-1',
  [STORAGE_KEYS.LIVE_LOCATION_USER_ID]: 'u1',
};

function fix(coords: Partial<Location.LocationObjectCoords> = {}): Location.LocationObject {
  return {
    coords: {
      latitude: 19.076,
      longitude: 72.8777,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...coords,
    },
    timestamp: 1_700_000_000_000,
  };
}

function registeredTask(): TaskCallback {
  registerLiveLocationTask();
  const callback = jest.mocked(TaskManager.defineTask).mock.calls[0]?.[1] as
    TaskCallback | undefined;
  if (callback === undefined) throw new Error('task was not defined');
  return callback;
}

describe('live-tracking task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockReset();
    storageWith({});
    jest.mocked(Battery.getBatteryLevelAsync).mockResolvedValue(1);
    jest.mocked(Battery.getBatteryStateAsync).mockResolvedValue(Battery.BatteryState.UNPLUGGED);
    useLocationStore.getState().reset();
    resetTrail(null);
  });

  describe('registerLiveLocationTask', () => {
    it('does not define the task twice', () => {
      jest.mocked(TaskManager.isTaskDefined).mockReturnValueOnce(true);
      registerLiveLocationTask();
      expect(TaskManager.defineTask).not.toHaveBeenCalled();
    });

    it('stops background updates when background location permission is revoked', async () => {
      const task = registeredTask();
      jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValueOnce({
        granted: false,
      } as never);
      storageWith({
        ...ACTIVE_SESSION,
        [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT]: String(Date.now() + 60_000),
      });

      await task({ data: { locations: [fix()] } });

      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
      expect(updateLiveLocation).not.toHaveBeenCalled();
    });

    it('terminates background updates when the session has expired', async () => {
      const task = registeredTask();
      storageWith({
        ...ACTIVE_SESSION,
        [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT]: String(Date.now() - 5000),
      });

      await task({ data: { locations: [fix()] } });

      expect(stopLiveLocationSession).toHaveBeenCalledWith('session-1');
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        STORAGE_KEYS.LIVE_LOCATION_SESSION_ID,
        STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT,
        STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE,
      ]);
    });

    it('writes the fix through the shared pipeline when permission is granted', async () => {
      const task = registeredTask();
      jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValueOnce({
        granted: true,
      } as never);
      storageWith({
        ...ACTIVE_SESSION,
        [STORAGE_KEYS.LIVE_LOCATION_EXPIRES_AT]: String(Date.now() + 60_000),
      });

      await task({ data: { locations: [fix()] } });

      expect(updateLiveLocation).toHaveBeenCalledTimes(1);
    });
  });

  describe('processLiveFix', () => {
    it('does nothing without a stored session', async () => {
      await processLiveFix(fix(), true);
      expect(updateLiveLocation).not.toHaveBeenCalled();
    });

    it('writes battery, signal and speed readings with the fix', async () => {
      storageWith(ACTIVE_SESSION);
      jest.mocked(Battery.getBatteryLevelAsync).mockResolvedValueOnce(0.62);

      await processLiveFix(fix({ speed: 1.4, heading: 90 }), false);

      expect(updateLiveLocation).toHaveBeenCalledWith('session-1', 19.076, 72.8777, true, {
        trackingProfile: 'walking',
        isCharging: false,
        batteryLevel: 0.62,
        accuracy: 5,
        speed: 1.4,
        heading: 90,
      });
      expect(useLocationStore.getState().liveTrackingProfile).toBe('walking');
      expect(useLocationStore.getState().liveBatteryLevel).toBe(0.62);
    });

    it('drops unusable readings instead of sending them', async () => {
      storageWith(ACTIVE_SESSION);
      jest.mocked(Battery.getBatteryLevelAsync).mockResolvedValueOnce(-1);

      await processLiveFix(fix({ speed: -1, heading: -1, accuracy: null }), false);

      const telemetry = jest.mocked(updateLiveLocation).mock.calls[0]?.[4];
      expect(telemetry).toEqual({ trackingProfile: 'walking', isCharging: false });
    });

    it('speeds up to the moving profile and retunes the background task', async () => {
      storageWith(ACTIVE_SESSION);

      await processLiveFix(fix({ speed: 8 }), true);

      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'surakshak-live-location',
        expect.objectContaining({
          timeInterval: 10_000,
          distanceInterval: 30,
          accuracy: Location.Accuracy.High,
        }),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE,
        JSON.stringify({ profile: 'moving', stationarySinceMs: null }),
      );
    });

    it('does not retune the task when the profile is unchanged', async () => {
      storageWith(ACTIVE_SESSION);

      await processLiveFix(fix({ speed: 1.4 }), true);

      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('does not retune when running as the foreground fallback', async () => {
      storageWith(ACTIVE_SESSION);

      await processLiveFix(fix({ speed: 8 }), false);

      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('drops to the stationary profile after standing still long enough', async () => {
      const longAgo = Date.now() - 10 * 60_000;
      storageWith({
        ...ACTIVE_SESSION,
        [STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE]: JSON.stringify({
          profile: 'walking',
          stationarySinceMs: longAgo,
        }),
      });

      await processLiveFix(fix({ speed: 0 }), true);

      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'surakshak-live-location',
        expect.objectContaining({ timeInterval: 60_000, distanceInterval: 50 }),
      );
    });

    it('switches to battery saver on a low battery even while moving', async () => {
      storageWith(ACTIVE_SESSION);
      jest.mocked(Battery.getBatteryLevelAsync).mockResolvedValueOnce(0.1);

      await processLiveFix(fix({ speed: 8 }), true);

      expect(useLocationStore.getState().liveTrackingProfile).toBe('low_battery');
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'surakshak-live-location',
        expect.objectContaining({ timeInterval: 120_000 }),
      );
    });

    it('ignores corrupt persisted tracking state', async () => {
      storageWith({
        ...ACTIVE_SESSION,
        [STORAGE_KEYS.LIVE_LOCATION_TRACKING_STATE]: '{not json',
      });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      await processLiveFix(fix({ speed: 1.4 }), true);

      expect(updateLiveLocation).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it('keeps sharing when retuning the task fails', async () => {
      storageWith(ACTIVE_SESSION);
      jest.mocked(Location.startLocationUpdatesAsync).mockRejectedValueOnce(new Error('boom'));

      await expect(processLiveFix(fix({ speed: 8 }), true)).resolves.toBeUndefined();
      expect(updateLiveLocation).toHaveBeenCalledTimes(1);
    });

    it('only records a trail point once the sender has moved far enough', async () => {
      storageWith(ACTIVE_SESSION);

      await processLiveFix(fix(), false);
      await processLiveFix(fix({ latitude: 19.0761 }), false); // about 11 m
      await processLiveFix(fix({ latitude: 19.078 }), false); // about 220 m

      const appendFlags = jest.mocked(updateLiveLocation).mock.calls.map((call) => call[3]);
      expect(appendFlags).toEqual([true, false, true]);
    });
  });
});
