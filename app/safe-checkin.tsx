import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { ContactMultiSelect } from '@/components/features/location/ContactMultiSelect';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { SAFE_CHECKIN_INTERVAL_OPTIONS_MINUTES } from '@/constants/config';
import { TIMING } from '@/constants/ui';
import { useSafeCheckin } from '@/hooks/useSafeCheckin';
import { useUserStore } from '@/stores/user.store';
import { formatEta } from '@/utils/date.utils';

const MS_PER_MINUTE = 60_000;

export default function SafeCheckinScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const emergencyContacts = useUserStore((state) => state.emergencyContacts);
  const customContacts = useMemo(
    () => emergencyContacts.filter((contact) => !contact.isPredefined),
    [emergencyContacts],
  );

  const {
    isActive,
    intervalMinutes,
    selectedContactIds,
    nextCheckInAt,
    missedCount,
    setSelectedContactIds,
    setIntervalMinutes,
    start,
    checkIn,
    stop,
  } = useSafeCheckin();

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), TIMING.SECOND_MS);
    return (): void => clearInterval(timer);
  }, [isActive]);

  const toggleContact = useCallback(
    (id: string): void => {
      setSelectedContactIds(
        selectedContactIds.includes(id)
          ? selectedContactIds.filter((value) => value !== id)
          : [...selectedContactIds, id],
      );
    },
    [selectedContactIds, setSelectedContactIds],
  );

  function handleStart(): void {
    start().catch((error: unknown) => {
      captureException(error);
      Alert.alert(t('errors.generic'));
    });
  }

  function handleCheckIn(): void {
    checkIn().catch((error: unknown) => {
      captureException(error);
      Alert.alert(t('errors.generic'));
    });
  }

  function handleStop(): void {
    Alert.alert(t('safeCheckin.stopConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('safeCheckin.stop'),
        style: 'destructive',
        onPress: (): void => {
          stop().catch((error: unknown) => captureException(error));
        },
      },
    ]);
  }

  const minutesUntilNext =
    nextCheckInAt === null
      ? 0
      : Math.max(0, Math.ceil((nextCheckInAt.getTime() - now) / MS_PER_MINUTE));

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="screens.safeCheckin" />

        {isActive ? (
          <View className="mt-2">
            <Card padding="lg" className="mb-4 border-2 border-forest-green">
              <View className="flex-row items-center gap-2">
                <View className="h-3 w-3 rounded-full bg-forest-green" />
                <Text variant="label" tKey="safeCheckin.active" />
              </View>

              <Text variant="body" tKey="safeCheckin.nextRequired" className="mt-2" />
              <Text variant="h2" className="text-shakti-purple">
                {formatEta(minutesUntilNext, new Date(now))}
              </Text>

              {missedCount > 0 && (
                <Text
                  variant="caption"
                  tKey="safeCheckin.missedCount"
                  tOptions={{ count: missedCount }}
                  className="mt-1 text-stone"
                />
              )}
            </Card>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mb-3"
              label={t('safeCheckin.checkInNow')}
              onPress={handleCheckIn}
            />
            <Button
              variant="danger"
              size="md"
              fullWidth
              label={t('safeCheckin.stop')}
              onPress={handleStop}
            />
          </View>
        ) : (
          <View className="mt-2">
            <Text variant="label" tKey="safeCheckin.intervalLabel" className="mb-2" />
            <View className="mb-6 flex-row flex-wrap gap-2">
              {SAFE_CHECKIN_INTERVAL_OPTIONS_MINUTES.map((minutes) => {
                const selected = minutes === intervalMinutes;
                return (
                  <Button
                    key={minutes}
                    variant={selected ? 'secondary' : 'outline'}
                    size="sm"
                    label={t('safeCheckin.intervalShort', { minutes })}
                    onPress={() => setIntervalMinutes(minutes)}
                  />
                );
              })}
            </View>

            <Text variant="label" tKey="safeCheckin.contactsLabel" className="mb-2" />
            <ContactMultiSelect
              contacts={customContacts}
              selectedIds={selectedContactIds}
              onToggle={toggleContact}
            />

            <Card padding="md" className="mt-6 bg-off-white">
              <Text variant="caption" tKey="safeCheckin.info" className="text-stone" />
            </Card>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6"
              label={t('safeCheckin.start')}
              disabled={selectedContactIds.length === 0}
              onPress={handleStart}
            />
          </View>
        )}
      </SafeScreen>
    </ErrorBoundary>
  );
}
