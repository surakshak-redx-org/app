import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { z } from 'zod';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { ICON_SIZE } from '@/constants/ui';
import { trackIncidentReportSubmitted } from '@/services/analytics.service';
import {
  getMyIncidentReports,
  submitIncidentReport,
  uploadIncidentPhoto,
  type IncidentReport,
} from '@/services/firebase/incident.service';
import { getCurrentLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth.store';
import type { LocationData } from '@/types/location.types';
import { formatTimestamp } from '@/utils/date.utils';

type ActiveView = 'new' | 'history';

interface IncidentFormValues {
  title: string;
  description: string;
}

const STATUS_BADGE: Record<IncidentReport['status'], BadgeVariant> = {
  submitted: 'info',
  under_review: 'warning',
  resolved: 'success',
};

const DESCRIPTION_LINES = 4;

export default function IncidentReportScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const userId = useAuthStore((state) => state.user?.uid ?? null);

  const [activeView, setActiveView] = useState<ActiveView>('new');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(APP_CONFIG.INCIDENT_TITLE_MIN_LENGTH)
          .max(APP_CONFIG.INCIDENT_TITLE_MAX_LENGTH),
        description: z
          .string()
          .trim()
          .min(APP_CONFIG.INCIDENT_DESCRIPTION_MIN_LENGTH)
          .max(APP_CONFIG.INCIDENT_DESCRIPTION_MAX_LENGTH),
      }),
    [],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { title: '', description: '' },
  });

  // The plain loaders below only set state from their async completion, never
  // synchronously — so the mount effect can call them directly. The "refresh"
  // versions flip the loading flag first for a click handler's immediate
  // feedback; both share the same completion logic.
  const runLocationFetch = useCallback((): void => {
    getCurrentLocation()
      .then(setLocation)
      .catch((error: unknown) => captureException(error))
      .finally(() => setIsLoadingLocation(false));
  }, []);

  const fetchLocation = useCallback((): void => {
    setIsLoadingLocation(true);
    runLocationFetch();
  }, [runLocationFetch]);

  const runHistoryLoad = useCallback((): void => {
    if (userId === null) return;
    getMyIncidentReports(userId)
      .then(setIncidents)
      .catch((error: unknown) => captureException(error))
      .finally(() => setIsLoadingHistory(false));
  }, [userId]);

  const loadHistory = useCallback((): void => {
    if (userId === null) return;
    setIsLoadingHistory(true);
    runHistoryLoad();
  }, [userId, runHistoryLoad]);

  useEffect(() => {
    runLocationFetch();
    runHistoryLoad();
  }, [runLocationFetch, runHistoryLoad]);

  async function handleAddPhoto(): Promise<void> {
    if (photoUris.length >= APP_CONFIG.INCIDENT_MAX_PHOTOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: APP_CONFIG.COMMUNITY_IMAGE_QUALITY,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return;
    setPhotoUris((current) => [...current, asset.uri]);
  }

  function handleRemovePhoto(uri: string): void {
    setPhotoUris((current) => current.filter((value) => value !== uri));
  }

  const handleSubmitReport = useCallback(
    async (values: IncidentFormValues): Promise<void> => {
      if (userId === null || location === null) return;
      try {
        setIsSubmitting(true);
        // Photo count is capped at INCIDENT_MAX_PHOTOS, so uploading them
        // concurrently rather than one-at-a-time is a bounded burst, not an
        // unbounded one.
        const photoUrls = await Promise.all(
          photoUris.map((uri) => uploadIncidentPhoto(userId, uri)),
        );

        await submitIncidentReport(userId, {
          title: values.title.trim(),
          description: values.description.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          photoUrls,
        });

        trackIncidentReportSubmitted(photoUrls.length);
        reset();
        setPhotoUris([]);
        loadHistory();
        Alert.alert(t('incidentReport.submittedTitle'), t('incidentReport.submittedBody'), [
          {
            text: t('incidentReport.viewHistory'),
            onPress: (): void => setActiveView('history'),
          },
          { text: t('common.ok'), style: 'cancel' },
        ]);
      } catch (error) {
        captureException(error);
        Alert.alert(t('errors.generic'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [location, loadHistory, photoUris, reset, t, userId],
  );

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="screens.incidentReport" />

        <View className="mb-4 mt-2 flex-row gap-2">
          <Button
            variant={activeView === 'new' ? 'secondary' : 'outline'}
            size="sm"
            label={t('incidentReport.tabNew')}
            onPress={() => setActiveView('new')}
          />
          <Button
            variant={activeView === 'history' ? 'secondary' : 'outline'}
            size="sm"
            label={t('incidentReport.tabHistory')}
            onPress={() => setActiveView('history')}
          />
        </View>

        {activeView === 'new' ? (
          <View>
            <Card padding="sm" className="mb-4">
              {isLoadingLocation ? (
                <View className="flex-row items-center gap-2">
                  <Spinner size="sm" />
                  <Text variant="caption" tKey="incidentReport.gettingLocation" />
                </View>
              ) : location !== null ? (
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name="location-on"
                    size={ICON_SIZE.ROW}
                    color={COLORS.PRIMARY_RED}
                  />
                  <Text variant="caption" className="flex-1">
                    {`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </Text>
                  <Pressable onPress={fetchLocation} accessibilityRole="button">
                    <MaterialIcons name="refresh" size={ICON_SIZE.ROW} color={COLORS.STONE} />
                  </Pressable>
                </View>
              ) : (
                <Text variant="caption" tKey="incidentReport.locationUnavailable" />
              )}
              <Text
                variant="caption"
                tKey="incidentReport.locationNote"
                className="mt-1 text-stone"
              />
            </Card>

            <Text
              variant="caption"
              tOptions={{ time: new Date().toLocaleString('en-IN') }}
              tKey="incidentReport.reportTime"
              className="mb-4 text-stone"
            />

            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <Input
                  label={t('incidentReport.titleLabel')}
                  placeholder={t('incidentReport.titlePlaceholder')}
                  maxLength={APP_CONFIG.INCIDENT_TITLE_MAX_LENGTH}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={
                    fieldState.error !== undefined ? t('incidentReport.titleInvalid') : undefined
                  }
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field, fieldState }) => (
                <Input
                  label={t('incidentReport.descriptionLabel')}
                  placeholder={t('incidentReport.descriptionPlaceholder')}
                  maxLength={APP_CONFIG.INCIDENT_DESCRIPTION_MAX_LENGTH}
                  multiline
                  numberOfLines={DESCRIPTION_LINES}
                  className="min-h-[120px]"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={
                    fieldState.error !== undefined
                      ? t('incidentReport.descriptionInvalid')
                      : undefined
                  }
                />
              )}
            />

            <Text variant="label" tKey="incidentReport.photosLabel" className="mb-2" />
            <Text variant="caption" tKey="incidentReport.photosHint" className="mb-3 text-stone" />

            <View className="flex-row flex-wrap gap-2">
              {photoUris.map((uri) => (
                <View key={uri} className="h-16 w-16">
                  <Image
                    source={{ uri }}
                    className="h-16 w-16 rounded-xl"
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                  <Pressable
                    onPress={() => handleRemovePhoto(uri)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.remove')}
                    className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-error-red"
                  >
                    <MaterialIcons name="close" size={12} color={COLORS.WHITE} />
                  </Pressable>
                </View>
              ))}

              {photoUris.length < APP_CONFIG.INCIDENT_MAX_PHOTOS && (
                <Pressable
                  onPress={() => void handleAddPhoto()}
                  accessibilityRole="button"
                  className="h-16 w-16 items-center justify-center rounded-xl border border-dashed border-stone/40"
                >
                  <MaterialIcons name="add-a-photo" size={24} color={COLORS.STONE} />
                </Pressable>
              )}
            </View>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6"
              label={t('incidentReport.submit')}
              loading={isSubmitting}
              disabled={!isValid || location === null || isSubmitting}
              onPress={() => void handleSubmit(handleSubmitReport)()}
            />

            <Card padding="md" className="mt-4 bg-off-white">
              <Text variant="caption" tKey="incidentReport.disclaimer" className="text-stone" />
            </Card>
          </View>
        ) : isLoadingHistory ? (
          <Spinner size="lg" className="mt-8 items-center" />
        ) : incidents.length === 0 ? (
          <EmptyState
            icon="document-text"
            title={t('incidentReport.noReportsTitle')}
            subtitle={t('incidentReport.noReportsSubtitle')}
          />
        ) : (
          <FlatList
            data={incidents}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <Card padding="md">
                <View className="flex-row items-center">
                  <Badge
                    label={t(`incidentReport.status.${item.status}`)}
                    variant={STATUS_BADGE[item.status]}
                  />
                  <View className="flex-1" />
                  <Text variant="caption" className="text-stone">
                    {formatTimestamp(item.createdAt.toDate())}
                  </Text>
                </View>

                <Text variant="label" className="mt-2">
                  {item.title}
                </Text>
                <Text variant="caption" numberOfLines={2} className="mt-1 text-stone">
                  {item.description}
                </Text>

                {item.photoUrls.length > 0 && (
                  <Text
                    variant="caption"
                    tKey="incidentReport.photosAttached"
                    tOptions={{ count: item.photoUrls.length }}
                    className="mt-1 text-stone"
                  />
                )}

                <View className="mt-2 flex-row items-center gap-1">
                  <MaterialIcons name="location-on" size={12} color={COLORS.STONE} />
                  <Text variant="caption" className="text-stone">
                    {`${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`}
                  </Text>
                </View>
              </Card>
            )}
          />
        )}
      </SafeScreen>
    </ErrorBoundary>
  );
}
