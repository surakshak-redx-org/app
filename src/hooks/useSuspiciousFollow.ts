import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { APP_CONFIG } from '@/constants/config';
import { STORAGE_FLAG_OFF, STORAGE_KEYS } from '@/constants/storage';
import { trackSuspiciousFollowDetected } from '@/services/analytics.service';
import { getLocationWithTimeout } from '@/services/location.service';
import { scheduleLocalNotification } from '@/services/notification.service';
import { getDistanceKm } from '@/utils/location.utils';

const METERS_PER_KM = 1000;
const MS_PER_SECOND = 1000;
const REQUIRED_MOVING_INTERVALS = 10;

interface LocationSnapshot {
  latitude: number;
  longitude: number;
  timestamp: number;
}

function metersBetween(a: LocationSnapshot, b: LocationSnapshot): number {
  return getDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * METERS_PER_KM;
}

async function isFollowDetectionEnabled(): Promise<boolean> {
  const setting = await AsyncStorage.getItem(STORAGE_KEYS.FOLLOW_DETECTION_ENABLED);
  return setting !== STORAGE_FLAG_OFF;
}

async function triggerFollowAlert(): Promise<void> {
  trackSuspiciousFollowDetected();
  await scheduleLocalNotification(
    '⚠️ Suspicious Activity Detected',
    'You may be being followed. Tap for safety options.',
    0,
    { type: 'suspicious_follow' },
  );
}

/**
 * Flags a possible follow: detects continuous movement over a sustained window.
 * Ignores inaccurate, stale, or stationary fixes, and handles GPS outages by
 * resetting the sampling window.
 */
export function useSuspiciousFollow(enabled: boolean): void {
  const alertFiredRef = useRef(false);
  const historyRef = useRef<LocationSnapshot[]>([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    alertFiredRef.current = false;
    historyRef.current = [];
    inFlightRef.current = false;

    async function checkForFollow(): Promise<void> {
      if (alertFiredRef.current) return;
      if (inFlightRef.current) return;
      if (!(await isFollowDetectionEnabled())) return;

      inFlightRef.current = true;
      try {
        const fix = await getLocationWithTimeout(
          APP_CONFIG.FOLLOW_FIX_TIMEOUT_SECONDS * MS_PER_SECOND,
        );

        if (fix.accuracy !== undefined && fix.accuracy > APP_CONFIG.FOLLOW_MAX_ACCURACY_METERS) {
          return;
        }

        const now = Date.now();
        if (now - fix.timestamp > APP_CONFIG.FOLLOW_MAX_FIX_AGE_SECONDS * MS_PER_SECOND) {
          return;
        }

        const last = historyRef.current[historyRef.current.length - 1];
        if (
          last !== undefined &&
          now - last.timestamp > APP_CONFIG.FOLLOW_MAX_SAMPLE_GAP_SECONDS * MS_PER_SECOND
        ) {
          historyRef.current = [];
        }

        const snapshot: LocationSnapshot = {
          latitude: fix.latitude,
          longitude: fix.longitude,
          timestamp: now,
        };

        historyRef.current.push(snapshot);
        if (historyRef.current.length > REQUIRED_MOVING_INTERVALS + 1) {
          historyRef.current.shift();
        }

        if (historyRef.current.length < REQUIRED_MOVING_INTERVALS + 1) return;

        let movingSteps = 0;
        const totalIntervals = historyRef.current.length - 1;
        for (let i = 1; i < historyRef.current.length; i += 1) {
          const prev = historyRef.current[i - 1];
          const curr = historyRef.current[i];
          if (prev !== undefined && curr !== undefined) {
            if (metersBetween(prev, curr) >= APP_CONFIG.FOLLOW_MIN_MOVEMENT_METERS) {
              movingSteps += 1;
            }
          }
        }

        const movingPercent = (movingSteps / totalIntervals) * 100;
        const lastStepMoved =
          last !== undefined &&
          metersBetween(last, snapshot) >= APP_CONFIG.FOLLOW_MIN_MOVEMENT_METERS;

        if (movingPercent >= APP_CONFIG.FOLLOW_MOVING_STEPS_PERCENT && lastStepMoved) {
          alertFiredRef.current = true;
          await triggerFollowAlert();
        }
      } catch (error) {
        console.warn('useSuspiciousFollow: could not get position fix:', error);
        historyRef.current = [];
      } finally {
        inFlightRef.current = false;
      }
    }

    const interval = setInterval(
      () => void checkForFollow(),
      APP_CONFIG.FOLLOW_CHECK_INTERVAL_SECONDS * MS_PER_SECOND,
    );

    return (): void => clearInterval(interval);
  }, [enabled]);
}
