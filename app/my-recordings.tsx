import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';
import {
  clearEvidenceRecordingHistory,
  type EvidenceRecordingRecord,
  getEvidenceRecordings,
} from '@/services/evidence.service';
import { sendEvidenceLinkAlert } from '@/services/sms.service';
import { useUserStore } from '@/stores/user.store';
import { formatSecondsAsClock, formatTimestamp } from '@/utils/date.utils';

export default function MyRecordingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [records, setRecords] = useState<EvidenceRecordingRecord[]>([]);

  const emergencyContacts = useUserStore((state) => state.emergencyContacts);
  const customContacts = useMemo(
    () => emergencyContacts.filter((contact) => !contact.isPredefined),
    [emergencyContacts],
  );

  const load = useCallback((): void => {
    getEvidenceRecordings()
      .then(setRecords)
      .catch((error: unknown) => captureException(error));
  }, []);

  useEffect(load, [load]);

  function confirmClear(): void {
    Alert.alert(t('silentRecording.clearRecordings'), t('silentRecording.clearRecordingsConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          clearEvidenceRecordingHistory()
            .then(() => setRecords([]))
            .catch((error: unknown) => captureException(error));
        },
      },
    ]);
  }

  function handleOpen(url: string): void {
    Linking.openURL(url).catch((error: unknown) => {
      captureException(error);
      Alert.alert(t('errors.generic'));
    });
  }

  function handleCopyLink(url: string): void {
    void Clipboard.setStringAsync(url).then(() => {
      Alert.alert(t('silentRecording.linkCopied'));
    });
  }

  function handleShare(url: string): void {
    if (customContacts.length === 0) return;
    sendEvidenceLinkAlert(customContacts, url).catch((error: unknown) => {
      captureException(error);
      Alert.alert(t('errors.generic'));
    });
  }

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="silentRecording.recordingsTitle" />

        {records.length === 0 ? (
          <EmptyState
            icon="mic-outline"
            title={t('silentRecording.recordingsEmpty')}
            subtitle={t('silentRecording.recordingsEmptyHint')}
          />
        ) : (
          <View>
            {records.map((record) => (
              <Card key={record.id} padding="md" className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="mic" size={ICON_SIZE.ROW} color={COLORS.SHAKTI_PURPLE} />
                    <Text variant="body">{formatSecondsAsClock(record.durationSeconds)}</Text>
                  </View>
                  <Text variant="caption" className="text-stone">
                    {formatTimestamp(new Date(record.createdAt))}
                  </Text>
                </View>

                {/* Stacked full-width, not a row — "Share with Emergency
                    Contacts" alone is too long to fit alongside the other
                    two actions in a card this narrow, worse still in hi/mr,
                    and a flex-row here just overflowed the card. */}
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="mt-3"
                  label={t('silentRecording.openRecording')}
                  onPress={() => handleOpen(record.url)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="mt-2"
                  label={t('silentRecording.copyLink')}
                  onPress={() => handleCopyLink(record.url)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="mt-2"
                  label={t('silentRecording.shareWithContacts')}
                  disabled={customContacts.length === 0}
                  onPress={() => handleShare(record.url)}
                />
              </Card>
            ))}

            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="mt-2"
              label={t('silentRecording.clearRecordings')}
              onPress={confirmClear}
            />
          </View>
        )}
      </SafeScreen>
    </ErrorBoundary>
  );
}
