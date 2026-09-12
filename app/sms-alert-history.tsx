import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Linking, Pressable, View } from 'react-native';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { LOCATION_UNAVAILABLE } from '@/constants/config';
import { FLATLIST_PERF_PROPS } from '@/constants/ui';
import { clearSMSAlertHistory, getSMSAlertHistory } from '@/services/sms.service';
import type { SMSAlertRecord, SMSAlertType } from '@/types/emergency.types';
import { formatTimestamp } from '@/utils/date.utils';

const TYPE_BADGE: Record<SMSAlertType, { variant: BadgeVariant; labelKey: string }> = {
  sos: { variant: 'error', labelKey: 'emergency.alertTypeSos' },
  low_battery: { variant: 'warning', labelKey: 'emergency.alertTypeLowBattery' },
  safe_journey: { variant: 'info', labelKey: 'emergency.alertTypeSafeJourney' },
  live_location: { variant: 'info', labelKey: 'emergency.alertTypeLiveLocation' },
  checkin_missed: { variant: 'error', labelKey: 'emergency.alertTypeCheckinMissed' },
};

interface AlertHistoryRowProps {
  record: SMSAlertRecord;
}

const AlertHistoryRow = React.memo(function AlertHistoryRow({
  record,
}: AlertHistoryRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const badge = TYPE_BADGE[record.type];
  const hasLocation = record.locationUrl.length > 0 && record.locationUrl !== LOCATION_UNAVAILABLE;

  return (
    <Card padding="md" className="mb-3">
      <View className="flex-row items-center justify-between">
        <Badge variant={badge.variant} label={t(badge.labelKey)} />
        <Text variant="caption" className="text-stone">
          {formatTimestamp(new Date(record.timestamp))}
        </Text>
      </View>
      <Text
        variant="body"
        tKey="emergency.alertSentSummary"
        tOptions={{ sent: record.contactsSent.length, failed: record.contactsFailed.length }}
        className="mt-2"
      />
      {hasLocation && (
        <Pressable
          onPress={() => {
            Linking.openURL(record.locationUrl).catch((error: unknown) => captureException(error));
          }}
          accessibilityRole="button"
          accessibilityLabel={t('emergency.viewLocation')}
          className="mt-2"
        >
          <Text variant="caption" tKey="emergency.viewLocation" className="text-shakti-purple" />
        </Pressable>
      )}
    </Card>
  );
});

export default function SmsAlertHistoryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [records, setRecords] = useState<SMSAlertRecord[]>([]);

  const load = useCallback((): void => {
    getSMSAlertHistory()
      .then(setRecords)
      .catch((error: unknown) => captureException(error));
  }, []);

  useEffect(load, [load]);

  const confirmClear = useCallback((): void => {
    Alert.alert(t('emergency.clearHistory'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          clearSMSAlertHistory()
            .then(() => setRecords([]))
            .catch((error: unknown) => captureException(error));
        },
      },
    ]);
  }, [t]);

  const renderItem = useCallback(
    ({ item }: { item: SMSAlertRecord }): React.JSX.Element => <AlertHistoryRow record={item} />,
    [],
  );

  const keyExtractor = useCallback((item: SMSAlertRecord): string => item.id, []);

  return (
    <ErrorBoundary>
      <SafeScreen>
        <ScreenHeader titleKey="emergency.alertHistoryTitle" />

        <FlatList
          data={records}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          {...FLATLIST_PERF_PROPS}
          contentContainerClassName="pb-8"
          ListEmptyComponent={
            <EmptyState
              icon="chatbox-ellipses-outline"
              title={t('emergency.alertHistoryEmpty')}
              subtitle={t('emergency.alertHistoryEmptyHint')}
            />
          }
          ListFooterComponent={
            records.length === 0 ? null : (
              <Button
                variant="ghost"
                size="md"
                fullWidth
                className="mt-2"
                label={t('emergency.clearHistory')}
                onPress={confirmClear}
              />
            )
          }
        />
      </SafeScreen>
    </ErrorBoundary>
  );
}
