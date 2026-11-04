import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { APP_CONFIG } from '@/constants/config';
import { STORAGE_FLAG_OFF, STORAGE_KEYS } from '@/constants/storage';
import { trackSuspiciousFollowDetected } from '@/services/analytics.service';
import { scheduleLocalNotification } from '@/services/notification.service';
import { getDistanceKm } from '@/utils/location.utils';

const METERS_PER_KM = 1000;
const MIN_SNAPSHOTS_FOR_MOVEMENT_CHECK = 3;
const MIN_SNAPSHOTS_FOR_FOLLOW_CHECK = 5;
const HISTORY_WINDOW_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

interface LocationSnapshot {
  latitude: number;
  longitude: number;
  timestamp: number;
}

function metersBetween(a: LocationSnapshot, b: { latitude: number; longitude: number }): number {
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
  ).catch((err) => {
    console.warn('triggerFollowAlert: notification failed or permission denied:', err);
  });
}

/**
 * Flags a possible follow: the device stays inside `FOLLOW_RADIUS_METERS` for
 * `FOLLOW_DURATION_MINUTES` after having moved at least `FOLLOW_MIN_MOVEMENT_METERS`
 * — i.e. the user was travelling, then something has kept pace with them.
 * Fires at most once per mount (see `alertFiredRef`), mirroring
 * `useShakeDetection`'s single-fire-then-reset pattern.
 */
export function useSuspiciousFollow(enabled: boolean): void {
  const alertFiredRef = useRef(false);
  const historyRef = useRef<LocationSnapshot[]>([]);

  useEffect(() => {
    if (!enabled) return;

    alertFiredRef.current = false;
    historyRef.current = [];
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleCheck = (delayMs: number): void => {
      if (isCancelled) return;
      timer = setTimeout(() => {
        void checkForFollow();
      }, delayMs);
    };

    async function checkForFollow(): Promise<void> {
      if (isCancelled || alertFiredRef.current) return;
      if (!(await isFollowDetectionEnabled())) {
        scheduleCheck(APP_CONFIG.FOLLOW_CHECK_INTERVAL_SECONDS * 1000);
        return;
      }

      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        scheduleCheck(APP_CONFIG.FOLLOW_CHECK_INTERVAL_SECONDS * 1000);
        return;
      }

      // Verify movement threshold before firing GPS fix; extend interval to 120s if stationary.
      if (
        typeof Location.getLastKnownPositionAsync === 'function' &&
        historyRef.current.length > 0
      ) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            const lastSnapshot = historyRef.current[historyRef.current.length - 1];
            if (lastSnapshot) {
              const movement = metersBetween(lastSnapshot, lastKnown.coords);
              if (movement < APP_CONFIG.FOLLOW_STATIONARY_THRESHOLD_METERS) {
                scheduleCheck(APP_CONFIG.FOLLOW_STATIONARY_INTERVAL_SECONDS * 1000);
                return;
              }
            }
          }
        } catch {
          // If reading last known position fails, proceed to fresh GPS fix
        }
      }

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const snapshot: LocationSnapshot = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };

        const cutoff = Date.now() - HISTORY_WINDOW_MINUTES * MS_PER_MINUTE;
        historyRef.current = [
          ...historyRef.current.filter((entry) => entry.timestamp > cutoff),
          snapshot,
        ];

        if (historyRef.current.length >= MIN_SNAPSHOTS_FOR_MOVEMENT_CHECK) {
          const oldest = historyRef.current[0];
          if (oldest !== undefined) {
            const totalMovement = metersBetween(oldest, snapshot);
            if (totalMovement >= APP_CONFIG.FOLLOW_MIN_MOVEMENT_METERS) {
              const followCutoff = Date.now() - APP_CONFIG.FOLLOW_DURATION_MINUTES * MS_PER_MINUTE;
              const recentHistory = historyRef.current.filter(
                (entry) => entry.timestamp > followCutoff,
              );
              if (recentHistory.length >= MIN_SNAPSHOTS_FOR_FOLLOW_CHECK) {
                const allWithinRadius = recentHistory.every(
                  (entry) => metersBetween(entry, snapshot) <= APP_CONFIG.FOLLOW_RADIUS_METERS,
                );
                if (allWithinRadius) {
                  alertFiredRef.current = true;
                  await triggerFollowAlert();
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('useSuspiciousFollow: could not get position fix:', error);
      }

      scheduleCheck(APP_CONFIG.FOLLOW_CHECK_INTERVAL_SECONDS * 1000);
    }

    scheduleCheck(APP_CONFIG.FOLLOW_CHECK_INTERVAL_SECONDS * 1000);

    return (): void => {
      isCancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [enabled]);
}
