import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { ENV } from '@/config/env';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import {
  PIN_CIRCLE_FILL,
  PIN_CIRCLE_STROKE,
  PIN_HEX,
  UNSAFE_AREA_CATEGORIES,
  UNSAFE_CATEGORY_LABEL_KEY,
} from '@/constants/map';
import { ROUTES } from '@/constants/routes';
import { ICON_SIZE } from '@/constants/ui';
import { useLocation } from '@/hooks/useLocation';
import { trackUnsafeAreaReported, trackUnsafeAreaVoted } from '@/services/analytics.service';
import {
  reportUnsafeArea,
  subscribeToUnsafeAreas,
  voteOnUnsafeArea,
} from '@/services/firebase/unsafe-areas.service';
import { getCurrentLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth.store';
import type { UnsafeArea, UnsafeAreaCategory } from '@/types/location.types';
import { debugLog } from '@/utils/debug-log';

interface ReportFormValues {
  title: string;
  description: string;
  category: UnsafeAreaCategory;
}

const TITLE_MIN = 3;
const TITLE_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 500;

const styles = StyleSheet.create({
  map: { flex: 1 },
});

export default function MapScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const isGuest = useAuthStore((state) => state.isGuest);
  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const rawUser = useAuthStore((state) => state.user);
  const userId = surakshakUser?.userId ?? rawUser?.uid ?? null;

  const { currentLocation, requestPermission } = useLocation();

  const [unsafeAreas, setUnsafeAreas] = useState<UnsafeArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<UnsafeArea | null>(null);
  const [legendVisible, setLegendVisible] = useState(false);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  // --- iOS blank-map diagnostics (dev only; remove once resolved) ---
  useEffect(() => {
    const nativeIosMapsKey = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
    debugLog('MapScreen', 'mounted', {
      platform: Platform.OS,
      provider: PROVIDER_GOOGLE,
      // The key the native Google Maps SDK actually uses on iOS — baked at
      // build/prebuild time from app.config.ts. Blank map ⇒ this is missing.
      nativeIosMapsKeySet: typeof nativeIosMapsKey === 'string' && nativeIosMapsKey.length > 0,
      nativeIosMapsKeyPrefix: nativeIosMapsKey?.slice(0, 8) ?? null,
      // The key the JS layer uses for the Places REST calls (works already).
      jsIosMapsKeyPrefix: ENV.GOOGLE_MAPS_API_KEY_IOS.slice(0, 8),
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
    });
  }, []);

  useEffect(() => {
    void requestPermission()
      .then((granted) => debugLog('MapScreen', 'location permission granted:', granted))
      .catch((error: unknown) => debugLog('MapScreen', 'requestPermission failed:', error));
  }, [requestPermission]);

  useEffect(() => {
    debugLog('MapScreen', 'currentLocation:', currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    debugLog('MapScreen', 'subscribing to unsafe areas');
    const unsubscribe = subscribeToUnsafeAreas((areas) => {
      debugLog('MapScreen', 'unsafe areas received:', areas.length);
      setUnsafeAreas(areas);
    });
    return unsubscribe;
  }, []);

  const initialRegion: Region = useMemo(() => {
    const region = {
      latitude: currentLocation?.latitude ?? APP_CONFIG.MAP_FALLBACK_LATITUDE,
      longitude: currentLocation?.longitude ?? APP_CONFIG.MAP_FALLBACK_LONGITUDE,
      latitudeDelta: APP_CONFIG.MAP_DEFAULT_LATITUDE_DELTA,
      longitudeDelta: APP_CONFIG.MAP_DEFAULT_LONGITUDE_DELTA,
    };
    debugLog('MapScreen', 'initialRegion:', region);
    return region;
  }, [currentLocation]);

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
        description: z.string().trim().min(DESCRIPTION_MIN).max(DESCRIPTION_MAX),
        category: z.enum(['poorly_lit', 'isolated', 'harassment_reported', 'other']),
      }),
    [],
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isValid },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { title: '', description: '', category: 'poorly_lit' },
  });
  const selectedCategory = useWatch({ control, name: 'category' });

  const requireSignIn = useCallback((): boolean => {
    if (userId !== null && !isGuest) return false;
    Alert.alert(t('map.guestCannotReport'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signInNow'), onPress: (): void => router.push(ROUTES.WELCOME) },
    ]);
    return true;
  }, [userId, isGuest, router, t]);

  const openReport = useCallback((): void => {
    if (requireSignIn()) return;
    reset({ title: '', description: '', category: 'poorly_lit' });
    setReportModalVisible(true);
  }, [requireSignIn, reset]);

  const submitReport = useCallback(
    async (values: ReportFormValues): Promise<void> => {
      if (userId === null) return;
      try {
        setSubmitting(true);
        const fix = await getCurrentLocation();
        await reportUnsafeArea(
          userId,
          fix.latitude,
          fix.longitude,
          values.title.trim(),
          values.description.trim(),
          values.category,
        );
        setReportModalVisible(false);
        Alert.alert(t('map.reportSubmitted'));
        trackUnsafeAreaReported(values.category);
      } catch (error) {
        captureException(error);
        Alert.alert(t('errors.generic'));
      } finally {
        setSubmitting(false);
      }
    },
    [userId, t],
  );

  const handleVote = useCallback(
    (area: UnsafeArea, vote: 'up' | 'down'): void => {
      if (requireSignIn() || userId === null) return;
      voteOnUnsafeArea(area.id, userId, vote)
        .then(() => trackUnsafeAreaVoted(vote))
        .catch((error: unknown) => {
          captureException(error);
          Alert.alert(t('errors.generic'));
        });
    },
    [requireSignIn, userId, t],
  );

  const hasVoted =
    selectedArea !== null && userId !== null && selectedArea.voterIds.includes(userId);

  return (
    <ErrorBoundary>
      <View className="flex-1">
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation
          showsMyLocationButton
          initialRegion={initialRegion}
          onMapReady={() => debugLog('MapScreen', 'MapView onMapReady')}
          onMapLoaded={() => debugLog('MapScreen', 'MapView onMapLoaded (tiles drawn)')}
          onLayout={(event) => debugLog('MapScreen', 'MapView onLayout', event.nativeEvent.layout)}
        >
          {unsafeAreas.map((area) => (
            <React.Fragment key={area.id}>
              <Marker
                coordinate={{ latitude: area.latitude, longitude: area.longitude }}
                pinColor={PIN_HEX[area.pinColor]}
                onPress={() => setSelectedArea(area)}
              />
              <Circle
                center={{ latitude: area.latitude, longitude: area.longitude }}
                radius={area.radiusMeters}
                strokeColor={PIN_CIRCLE_STROKE[area.pinColor]}
                fillColor={PIN_CIRCLE_FILL[area.pinColor]}
              />
            </React.Fragment>
          ))}
        </MapView>

        <SafeAreaView
          edges={['top', 'left', 'right']}
          pointerEvents="box-none"
          className="absolute inset-x-0 top-0"
        >
          <View className="flex-row items-center justify-between px-4 py-2">
            <Text variant="h3" tKey="map.title" className="rounded-lg bg-white/90 px-3 py-1" />
            <Pressable
              onPress={() => setLegendVisible((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={t('map.legend')}
              className="rounded-full bg-white/90 p-2"
            >
              <MaterialIcons name="info-outline" size={ICON_SIZE.ROW} color={COLORS.DEEP_INK} />
            </Pressable>
          </View>

          {legendVisible && (
            <Card padding="sm" className="mx-4 self-end">
              <View className="flex-row items-center gap-2 py-1">
                <View className="h-3 w-3 rounded-full bg-saffron" />
                <Text variant="caption" tKey="map.legendPending" />
              </View>
              <View className="flex-row items-center gap-2 py-1">
                <View className="h-3 w-3 rounded-full bg-primary-red" />
                <Text variant="caption" tKey="map.legendApproved" />
              </View>
            </Card>
          )}
        </SafeAreaView>

        <Pressable
          onPress={openReport}
          accessibilityRole="button"
          accessibilityLabel={t('map.reportArea')}
          className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary-red shadow-lg"
        >
          <MaterialIcons name="add-location" size={ICON_SIZE.PERMISSION} color={COLORS.WHITE} />
        </Pressable>

        {selectedArea !== null && (
          <View className="absolute inset-x-0 bottom-0">
            <Card padding="lg" className="rounded-b-none">
              <View className="flex-row items-center justify-between">
                <Text variant="h3" className="flex-1">
                  {selectedArea.title}
                </Text>
                <Badge
                  variant={selectedArea.status === 'approved' ? 'error' : 'warning'}
                  label={t(selectedArea.status === 'approved' ? 'map.approved' : 'map.pending')}
                />
              </View>

              <Text variant="body" className="mt-2">
                {selectedArea.description}
              </Text>
              <Text variant="caption" className="mt-1">
                {t('map.reportAreaCategory')}: {t(UNSAFE_CATEGORY_LABEL_KEY[selectedArea.category])}
              </Text>

              <View className="mt-3 flex-row items-center gap-3">
                <Text variant="label" className="flex-1">
                  {t('map.votes', { count: selectedArea.upvotes - selectedArea.downvotes })}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  label={t('map.upvote')}
                  disabled={hasVoted}
                  onPress={() => handleVote(selectedArea, 'up')}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  label={t('map.downvote')}
                  disabled={hasVoted}
                  onPress={() => handleVote(selectedArea, 'down')}
                />
              </View>

              <Button
                variant="outline"
                size="sm"
                className="mt-3 self-center"
                label={t('common.close')}
                onPress={() => setSelectedArea(null)}
              />
            </Card>
          </View>
        )}

        <Modal
          visible={isReportModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View className="flex-1 justify-end bg-near-black/40">
            <View className="rounded-t-3xl bg-off-white px-4 pb-8 pt-6">
              <Text variant="h3" tKey="map.reportArea" />
              <Text variant="caption" tKey="map.tapToSetLocation" className="mt-1" />

              <Controller
                control={control}
                name="title"
                render={({ field, fieldState }) => (
                  <Input
                    label={t('map.reportAreaTitle')}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    className="mt-4"
                  />
                )}
              />

              <Controller
                control={control}
                name="description"
                render={({ field, fieldState }) => (
                  <Input
                    label={t('map.reportAreaDescription')}
                    multiline
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              <Text variant="label" tKey="map.reportAreaCategory" className="mb-2" />
              <View className="flex-row flex-wrap gap-2">
                {UNSAFE_AREA_CATEGORIES.map((category) => {
                  const selected = category === selectedCategory;
                  return (
                    <Button
                      key={category}
                      variant={selected ? 'secondary' : 'outline'}
                      size="sm"
                      label={t(UNSAFE_CATEGORY_LABEL_KEY[category])}
                      onPress={() => setValue('category', category, { shouldValidate: true })}
                    />
                  );
                })}
              </View>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="mt-6"
                label={t('common.send')}
                loading={isSubmitting}
                disabled={!isValid || isSubmitting}
                onPress={() => void handleSubmit(submitReport)()}
              />
              <Button
                variant="ghost"
                size="md"
                className="mt-2 self-center"
                label={t('common.cancel')}
                onPress={() => setReportModalVisible(false)}
              />
            </View>
          </View>
        </Modal>
      </View>
    </ErrorBoundary>
  );
}
