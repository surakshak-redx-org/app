import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { z } from 'zod';

import { GuestBanner } from '@/components/features/auth/GuestBanner';
import { ContactMultiSelect } from '@/components/features/location/ContactMultiSelect';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG, SAFE_JOURNEY_ETA_PRESETS_MINUTES } from '@/constants/config';
import { ICON_SIZE, TIMING } from '@/constants/ui';
import {
  trackSafeJourneyAlertSent,
  trackSafeJourneyArrived,
  trackSafeJourneyStarted,
} from '@/services/analytics.service';
import {
  cancelSafeJourney,
  checkInSafeJourney,
  createSafeJourneySession,
  extendSafeJourneyEta,
  getActiveJourneySession,
  markAlertSent,
  markSafeJourneyArrived,
} from '@/services/firebase/safe-journey.service';
import { getCurrentLocation } from '@/services/location.service';
import { recordSMSAlert, sendSafeJourneyAlert } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import type { SafeJourneySession } from '@/types/location.types';
import { formatDuration, formatEta } from '@/utils/date.utils';
import { getLocationUrl } from '@/utils/location.utils';

interface JourneyFormValues {
  destination: string;
  etaMinutes: number;
}

const DESTINATION_MIN = 2;
const DESTINATION_MAX = 100;

export default function SafeJourneyScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const rawUser = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = surakshakUser?.userId ?? rawUser?.uid ?? null;

  const emergencyContacts = useUserStore((state) => state.emergencyContacts);
  const customContacts = useMemo(
    () => emergencyContacts.filter((contact) => !contact.isPredefined),
    [emergencyContacts],
  );

  const setSafeJourneyActive = useLocationStore((state) => state.setSafeJourneyActive);

  const [activeSession, setActiveSession] = useState<SafeJourneySession | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const alertFiredRef = useRef(false);

  const schema = useMemo(
    () =>
      z.object({
        destination: z.string().trim().min(DESTINATION_MIN).max(DESTINATION_MAX),
        etaMinutes: z
          .number()
          .int()
          .min(APP_CONFIG.SAFE_JOURNEY_ETA_MIN_MINUTES)
          .max(APP_CONFIG.SAFE_JOURNEY_ETA_MAX_MINUTES),
      }),
    [],
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isValid },
  } = useForm<JourneyFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { destination: '', etaMinutes: APP_CONFIG.SAFE_JOURNEY_ETA_DEFAULT_MINUTES },
  });

  const etaMinutes = useWatch({ control, name: 'etaMinutes' });

  const toggleContact = useCallback((id: string): void => {
    setSelectedContactIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);

  const applySession = useCallback(
    (session: SafeJourneySession | null): void => {
      setActiveSession(session);
      if (session !== null) {
        setSafeJourneyActive(true, session.id);
        alertFiredRef.current = false;
      }
    },
    [setSafeJourneyActive],
  );

  const refreshActiveSession = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    applySession(await getActiveJourneySession(userId));
  }, [userId, applySession]);

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    void getActiveJourneySession(userId)
      .then((session) => {
        if (active) applySession(session);
      })
      .catch((error: unknown) => captureException(error));
    return (): void => {
      active = false;
    };
  }, [userId, applySession]);

  const contactsFor = useCallback(
    (ids: string[]) => emergencyContacts.filter((contact) => ids.includes(contact.id)),
    [emergencyContacts],
  );

  const sendMissedAlert = useCallback(
    async (session: SafeJourneySession): Promise<void> => {
      await markAlertSent(session.id);
      let locationUrl = getLocationUrl(session.destinationLatitude, session.destinationLongitude);
      try {
        const fix = await getCurrentLocation();
        locationUrl = getLocationUrl(fix.latitude, fix.longitude);
      } catch (locationError) {
        console.warn('safe-journey: location unavailable for alert:', locationError);
      }
      const name = surakshakUser?.name ?? 'User';
      const language = surakshakUser?.language ?? 'en';
      const result = await sendSafeJourneyAlert(
        contactsFor(session.sharedWithUserIds),
        locationUrl,
        name,
        session.destinationName,
        formatEta(session.etaMinutes, session.startedAt.toDate()),
        language,
      );
      await recordSMSAlert({
        type: 'safe_journey',
        locationUrl,
        contactsSent: result.sent,
        contactsFailed: result.failed,
      });
      trackSafeJourneyAlertSent();
    },
    [surakshakUser, contactsFor],
  );

  // Per-second countdown tick for the active journey.
  useEffect(() => {
    if (activeSession === null) return;
    const timer = setInterval(() => setNow(Date.now()), TIMING.SECOND_MS);
    return (): void => clearInterval(timer);
  }, [activeSession]);

  const secondsLeft =
    activeSession === null
      ? 0
      : Math.max(0, Math.floor((activeSession.expectedArrivalAt.toDate().getTime() - now) / 1000));

  // Fire the missed-arrival alert exactly once when the countdown hits zero.
  useEffect(() => {
    if (activeSession === null || activeSession.status !== 'active' || secondsLeft > 0) return;
    if (alertFiredRef.current) return;
    alertFiredRef.current = true;
    void sendMissedAlert(activeSession)
      .then(() => {
        setSafeJourneyActive(false);
        setActiveSession(null);
      })
      .catch((error: unknown) => captureException(error));
  }, [activeSession, secondsLeft, sendMissedAlert, setSafeJourneyActive]);

  const handleStart = useCallback(
    async (values: JourneyFormValues): Promise<void> => {
      if (userId === null) return;
      try {
        setIsLoading(true);
        const fix = await getCurrentLocation();
        const sessionId = await createSafeJourneySession(
          userId,
          values.destination.trim(),
          fix.latitude,
          fix.longitude,
          values.etaMinutes,
          selectedContactIds,
        );
        setSafeJourneyActive(true, sessionId);

        const locationUrl = getLocationUrl(fix.latitude, fix.longitude);
        const name = surakshakUser?.name ?? 'User';
        const language = surakshakUser?.language ?? 'en';
        const result = await sendSafeJourneyAlert(
          contactsFor(selectedContactIds),
          locationUrl,
          name,
          values.destination.trim(),
          formatEta(values.etaMinutes),
          language,
        );
        await recordSMSAlert({
          type: 'safe_journey',
          locationUrl,
          contactsSent: result.sent,
          contactsFailed: result.failed,
        });
        trackSafeJourneyStarted(values.etaMinutes, selectedContactIds.length);
        await refreshActiveSession();
      } catch (error) {
        captureException(error);
        Alert.alert(t('errors.generic'));
      } finally {
        setIsLoading(false);
      }
    },
    [
      userId,
      selectedContactIds,
      surakshakUser,
      contactsFor,
      setSafeJourneyActive,
      refreshActiveSession,
      t,
    ],
  );

  const handleCheckIn = useCallback((): void => {
    if (activeSession === null) return;
    checkInSafeJourney(activeSession.id)
      .then(() => refreshActiveSession())
      .catch((error: unknown) => {
        captureException(error);
        Alert.alert(t('errors.generic'));
      });
  }, [activeSession, refreshActiveSession, t]);

  const handleArrived = useCallback((): void => {
    if (activeSession === null) return;
    Alert.alert(t('location.iArrivedConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('location.iArrived'),
        onPress: (): void => {
          markSafeJourneyArrived(activeSession.id)
            .then(() => {
              setSafeJourneyActive(false);
              setActiveSession(null);
              trackSafeJourneyArrived();
              router.back();
            })
            .catch((error: unknown) => {
              captureException(error);
              Alert.alert(t('errors.generic'));
            });
        },
      },
    ]);
  }, [activeSession, setSafeJourneyActive, router, t]);

  const handleExtend = useCallback(
    (minutes: number): void => {
      if (activeSession === null) return;
      extendSafeJourneyEta(activeSession.id, minutes)
        .then(() => refreshActiveSession())
        .catch((error: unknown) => {
          captureException(error);
          Alert.alert(t('errors.generic'));
        });
    },
    [activeSession, refreshActiveSession, t],
  );

  const handleCancel = useCallback((): void => {
    if (activeSession === null) return;
    Alert.alert(t('location.cancelJourneyConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('location.cancelJourney'),
        style: 'destructive',
        onPress: (): void => {
          cancelSafeJourney(activeSession.id)
            .then(() => {
              setSafeJourneyActive(false);
              setActiveSession(null);
            })
            .catch((error: unknown) => {
              captureException(error);
              Alert.alert(t('errors.generic'));
            });
        },
      },
    ]);
  }, [activeSession, setSafeJourneyActive, t]);

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="location.safeJourney" />

        {activeSession !== null ? (
          <View className="mt-2">
            <Card padding="lg" className="border-2 border-shakti-purple">
              <View className="flex-row items-center gap-2">
                <MaterialIcons
                  name="directions-walk"
                  size={ICON_SIZE.PERMISSION}
                  color={COLORS.SHAKTI_PURPLE}
                />
                <Text variant="h3" className="flex-1">
                  {activeSession.destinationName}
                </Text>
              </View>

              <Text variant="caption" className="mt-3">
                {t('location.arrivalTime')}
              </Text>
              <Text variant="label">
                {formatEta(activeSession.etaMinutes, activeSession.startedAt.toDate())}
              </Text>

              <Text
                variant="h2"
                className={
                  secondsLeft <= APP_CONFIG.SAFE_JOURNEY_ALERT_WARN_SECONDS
                    ? 'mt-3 text-error-red'
                    : 'mt-3'
                }
              >
                {formatDuration(Math.ceil(secondsLeft / 60))}
              </Text>
            </Card>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              label={t('location.imSafe')}
              onPress={handleCheckIn}
            />
            <Button
              variant="secondary"
              size="md"
              fullWidth
              className="mt-3"
              label={t('location.iArrived')}
              onPress={handleArrived}
            />

            <View className="mt-3 flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                label={t('location.plus15Min')}
                onPress={() => handleExtend(15)}
              />
              <Button
                variant="outline"
                size="sm"
                label={t('location.plus30Min')}
                onPress={() => handleExtend(30)}
              />
            </View>

            <Button
              variant="ghost"
              size="md"
              className="mt-3"
              label={t('location.cancelJourney')}
              onPress={handleCancel}
            />
          </View>
        ) : (
          <View className="mt-2">
            {isGuest && <GuestBanner />}

            <Controller
              control={control}
              name="destination"
              render={({ field, fieldState }) => (
                <Input
                  label={t('location.destination')}
                  placeholder={t('location.destinationPlaceholder')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  className="mt-4"
                />
              )}
            />

            <Text variant="label" tKey="location.etaMinutes" className="mb-2" />
            <View className="flex-row flex-wrap gap-2">
              {SAFE_JOURNEY_ETA_PRESETS_MINUTES.map((minutes) => {
                const selected = minutes === etaMinutes;
                return (
                  <Button
                    key={minutes}
                    variant={selected ? 'secondary' : 'outline'}
                    size="sm"
                    label={t('location.minutesShort', { count: minutes })}
                    onPress={() => setValue('etaMinutes', minutes, { shouldValidate: true })}
                  />
                );
              })}
            </View>

            <Input
              keyboardType="number-pad"
              value={String(etaMinutes)}
              onChangeText={(text) =>
                setValue('etaMinutes', Number.parseInt(text, 10) || 0, { shouldValidate: true })
              }
              className="mt-3"
            />

            <Text variant="label" tKey="location.selectContacts" className="mb-2 mt-2" />
            <ContactMultiSelect
              contacts={customContacts}
              selectedIds={selectedContactIds}
              onToggle={toggleContact}
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-8"
              label={t('location.startJourney')}
              loading={isLoading}
              disabled={!isValid || selectedContactIds.length === 0 || isLoading}
              onPress={() => void handleSubmit(handleStart)()}
            />
          </View>
        )}
      </SafeScreen>
    </ErrorBoundary>
  );
}
