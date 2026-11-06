import { MaterialIcons } from '@expo/vector-icons';
import GorhomBottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useFocusEffect,
  useGlobalSearchParams,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { cssInterop } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Input } from '@/components/ui/Input';
import { ReplayBlock } from '@/components/ui/ReplayBlock';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import {
  HELP_CATEGORIES,
  HELP_CATEGORY_COLORS,
  HELP_CATEGORY_ICON,
  HELP_CATEGORY_LABEL_KEY,
  NEARBY_CATEGORY_COUNT,
  NEARBY_SHEET_HALF_INDEX,
  NEARBY_SHEET_SNAP_DELAY_MS,
  NEARBY_SHEET_SNAP_POINTS,
  NEARBY_REFETCH_METERS,
  NEARBY_REFETCH_MS,
  PIN_CIRCLE_FILL,
  PIN_CIRCLE_STROKE,
  PIN_HEX,
  UNSAFE_AREA_CATEGORIES,
  UNSAFE_CATEGORY_LABEL_KEY,
} from '@/constants/map';
import { ROUTES } from '@/constants/routes';
import { ICON_SIZE } from '@/constants/ui';
import { useLocation } from '@/hooks/useLocation';
import { useTheme } from '@/hooks/useTheme';
import {
  trackNearbyHelpCalled,
  trackNearbyHelpDirections,
  trackNearbyHelpViewed,
  trackUnsafeAreaReported,
  trackUnsafeAreaVoted,
} from '@/services/analytics.service';
import {
  reportUnsafeArea,
  subscribeToUnsafeAreas,
  voteOnUnsafeArea,
} from '@/services/firebase/unsafe-areas.service';
import { fetchNearbyPlaces, getFreshLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import type {
  HelpCategory,
  NearbyPlace,
  UnsafeArea,
  UnsafeAreaCategory,
} from '@/types/location.types';
import { getDistanceKm, locationErrorKey } from '@/utils/location.utils';
import { placeCall } from '@/utils/phone.utils';

interface ReportFormValues {
  title: string;
  description: string;
  category: UnsafeAreaCategory;
}

type PlacesByCategory = Record<HelpCategory, NearbyPlace[]>;

const EMPTY_PLACES: PlacesByCategory = {
  police: [],
  hospital: [],
  fire_station: [],
  pharmacy: [],
};

const TITLE_MIN = 3;
const TITLE_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 500;
const METERS_PER_KM = 1000;

function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * METERS_PER_KM)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

// Register third-party components with NativeWind so className maps to their style props.
cssInterop(MapView, { className: 'style' });
cssInterop(GorhomBottomSheet, {
  className: 'style',
  backgroundClassName: 'backgroundStyle',
  handleIndicatorClassName: 'handleIndicatorStyle',
});

export default function MapScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const isGuest = useAuthStore((state) => state.isGuest);
  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const rawUser = useAuthStore((state) => state.user);
  const userId = surakshakUser?.userId ?? rawUser?.uid ?? null;

  const { currentLocation, requestPermission } = useLocation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const cachedUnsafeAreas = useLocationStore((state) => state.cachedUnsafeAreas);
  const setCachedUnsafeAreas = useLocationStore((state) => state.setCachedUnsafeAreas);

  const [unsafeAreas, setUnsafeAreas] = useState<UnsafeArea[]>(cachedUnsafeAreas);
  // Only the id is kept: the card reads the area from the live list, so its
  // vote count and "already voted" state follow every snapshot instead of
  // freezing at the moment the pin was tapped (BUG-015).
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [votingAreaId, setVotingAreaId] = useState<string | null>(null);
  const [legendVisible, setLegendVisible] = useState(false);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const localParams = useLocalSearchParams<{ openHelp?: string }>();
  const globalParams = useGlobalSearchParams<{ openHelp?: string }>();
  const openHelp = localParams.openHelp ?? globalParams.openHelp;
  const consumedParamRef = useRef<string | null>(null);
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      const isDeepLinkHelp = openHelp === '1' && consumedParamRef.current !== openHelp;
      const isRequested = useLocationStore.getState().isNearbyHelpRequested || isDeepLinkHelp;
      if (isRequested) {
        consumedParamRef.current = openHelp ?? null;
        useLocationStore.getState().clearNearbyHelpRequest();
        const timer = setTimeout(() => {
          bottomSheetRef.current?.snapToIndex(NEARBY_SHEET_HALF_INDEX);
        }, NEARBY_SHEET_SNAP_DELAY_MS);
        return (): void => {
          clearTimeout(timer);
          setIsFocused(false);
        };
      }
      return (): void => {
        setIsFocused(false);
      };
    }, [openHelp]),
  );

  const [nearbyPlaces, setNearbyPlaces] = useState<PlacesByCategory>(EMPTY_PLACES);
  const [isFetchingPlaces, setIsFetchingPlaces] = useState(false);
  const [activeHelpCategory, setActiveHelpCategory] = useState<HelpCategory>('police');
  const [sheetIndex, setSheetIndex] = useState(0);
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);

  const mapRef = useRef<MapView | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  const lastFetchRef = useRef<{ lat: number; lon: number; at: number } | null>(null);

  const fetchRequestIdRef = useRef(0);

  // Only the latest request may write state; a skipped re-run must not cancel an in-flight fetch.
  const fetchNearbyCallback = useCallback(async (lat: number, lon: number): Promise<void> => {
    fetchRequestIdRef.current += 1;
    const requestId = fetchRequestIdRef.current;
    setIsFetchingPlaces(true);
    try {
      let failedCount = 0;
      const safeFetch = (category: HelpCategory): Promise<NearbyPlace[]> =>
        fetchNearbyPlaces(lat, lon, category).catch((): NearbyPlace[] => {
          failedCount += 1;
          return [];
        });
      const [police, hospital, fire_station, pharmacy] = await Promise.all([
        safeFetch('police'),
        safeFetch('hospital'),
        safeFetch('fire_station'),
        safeFetch('pharmacy'),
      ]);
      if (requestId !== fetchRequestIdRef.current) return;
      setNearbyPlaces({ police, hospital, fire_station, pharmacy });
      // Every category failed: forget the fetch so the next location update retries.
      if (failedCount === NEARBY_CATEGORY_COUNT) lastFetchRef.current = null;
    } catch (error: unknown) {
      captureException(error);
      if (requestId === fetchRequestIdRef.current) lastFetchRef.current = null;
    } finally {
      if (requestId === fetchRequestIdRef.current) setIsFetchingPlaces(false);
    }
  }, []);

  useEffect(() => {
    const requestIdRef = fetchRequestIdRef;
    return (): void => {
      // Invalidate in-flight work on unmount.
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!currentLocation) return;
    const last = lastFetchRef.current;
    if (last) {
      const movedMeters =
        getDistanceKm(last.lat, last.lon, currentLocation.latitude, currentLocation.longitude) *
        METERS_PER_KM;
      if (movedMeters < NEARBY_REFETCH_METERS && Date.now() - last.at < NEARBY_REFETCH_MS) {
        return;
      }
    }
    lastFetchRef.current = {
      lat: currentLocation.latitude,
      lon: currentLocation.longitude,
      at: Date.now(),
    };
    void fetchNearbyCallback(currentLocation.latitude, currentLocation.longitude);
  }, [currentLocation, fetchNearbyCallback]);

  const nearestFacilitySummary = useMemo(() => {
    if (
      isFetchingPlaces &&
      nearbyPlaces.police.length === 0 &&
      nearbyPlaces.hospital.length === 0
    ) {
      return t('location.findingHelp');
    }
    const nearestPolice = nearbyPlaces.police[0];
    const nearestHospital = nearbyPlaces.hospital[0];
    if (nearestPolice && nearestHospital) {
      return t('location.nearestSummary', {
        police: formatDistance(nearestPolice.distanceKm),
        hospital: formatDistance(nearestHospital.distanceKm),
      });
    }
    if (nearestPolice) {
      return t('location.nearestFacility', {
        distance: formatDistance(nearestPolice.distanceKm),
        type: t('location.policeStations'),
      });
    }
    if (nearestHospital) {
      return t('location.nearestFacility', {
        distance: formatDistance(nearestHospital.distanceKm),
        type: t('location.hospitals'),
      });
    }
    return t('location.nearbyHelp');
  }, [isFetchingPlaces, nearbyPlaces.police, nearbyPlaces.hospital, t]);

  const selectHelpCategory = useCallback((category: HelpCategory): void => {
    setActiveHelpCategory(category);
    trackNearbyHelpViewed(category);
  }, []);

  const handleCall = useCallback(
    (place: NearbyPlace): void => {
      if (place.phoneNumber === undefined) return;
      trackNearbyHelpCalled(activeHelpCategory);
      placeCall(place.phoneNumber).catch((error: unknown) => {
        captureException(error);
        const isNoTelephony =
          error instanceof Error && error.message === 'errors.telephonyUnavailable';
        Alert.alert(t(isNoTelephony ? 'errors.telephonyUnavailable' : 'errors.callFailed'));
      });
    },
    [activeHelpCategory, t],
  );

  const handleDirections = useCallback(
    (place: NearbyPlace): void => {
      trackNearbyHelpDirections(activeHelpCategory);
      void Linking.openURL(directionsUrl(place.latitude, place.longitude)).catch((error: unknown) =>
        captureException(error),
      );
    },
    [activeHelpCategory],
  );

  const selectedArea = useMemo(
    () => unsafeAreas.find((area) => area.id === selectedAreaId) ?? null,
    [unsafeAreas, selectedAreaId],
  );

  useEffect(() => {
    void requestPermission().catch((error: unknown) => {
      console.warn('MapScreen: requestPermission failed:', error);
    });
  }, [requestPermission]);

  useEffect(() => {
    const unsubscribe = subscribeToUnsafeAreas((areas) => {
      setUnsafeAreas(areas);
      setCachedUnsafeAreas(areas);
    });
    return unsubscribe;
  }, [setCachedUnsafeAreas]);

  // Smoothly glide camera from fallback coordinates to actual GPS location
  // upon initial acquisition, without overriding manual map panning (BUG-064).
  useEffect(() => {
    if (currentLocation && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: APP_CONFIG.MAP_DEFAULT_LATITUDE_DELTA,
          longitudeDelta: APP_CONFIG.MAP_DEFAULT_LONGITUDE_DELTA,
        },
        800,
      );
    }
  }, [currentLocation]);

  const handlePanDrag = useCallback((): void => {
    hasCenteredOnUserRef.current = true;
  }, []);

  const initialRegion: Region = useMemo(
    () => ({
      latitude: currentLocation?.latitude ?? APP_CONFIG.MAP_FALLBACK_LATITUDE,
      longitude: currentLocation?.longitude ?? APP_CONFIG.MAP_FALLBACK_LONGITUDE,
      latitudeDelta: APP_CONFIG.MAP_DEFAULT_LATITUDE_DELTA,
      longitudeDelta: APP_CONFIG.MAP_DEFAULT_LONGITUDE_DELTA,
    }),
    [currentLocation],
  );

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
        const fix = await getFreshLocation();
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
        Alert.alert(t(locationErrorKey(error) ?? 'errors.generic'));
      } finally {
        setSubmitting(false);
      }
    },
    [userId, t],
  );

  const handleVote = useCallback(
    (area: UnsafeArea, vote: 'up' | 'down'): void => {
      if (requireSignIn() || userId === null || votingAreaId !== null) return;
      // One vote in flight at a time — a quick double tap used to pass the
      // "already voted" check twice.
      setVotingAreaId(area.id);
      voteOnUnsafeArea(area.id, userId, vote)
        .then(() => trackUnsafeAreaVoted(vote))
        .catch((error: unknown) => {
          captureException(error);
          Alert.alert(t('errors.generic'));
        })
        .finally(() => setVotingAreaId(null));
    },
    [requireSignIn, userId, votingAreaId, t],
  );

  const hasVoted =
    selectedArea !== null && userId !== null && selectedArea.voterIds.includes(userId);

  return (
    <ErrorBoundary>
      <ReplayBlock>
        <View className="flex-1">
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            className="flex-1"
            showsUserLocation
            showsMyLocationButton
            initialRegion={initialRegion}
            onPanDrag={handlePanDrag}
            // Android's My Location button defaults to top-right (rendering
            // under the status bar without this); iOS's defaults to
            // bottom-right (overlapping the report FAB there). `mapPadding`
            // insets the native controls' corners without moving the camera.
            mapPadding={{
              top: insets.top + APP_CONFIG.MAP_HEADER_HEIGHT,
              right: 0,
              bottom: insets.bottom + APP_CONFIG.MAP_CONTROL_BOTTOM_CLEARANCE,
              left: 0,
            }}
          >
            {isFocused && (
              <>
                {unsafeAreas.map((area) => (
                  <React.Fragment key={area.id}>
                    <Marker
                      coordinate={{ latitude: area.latitude, longitude: area.longitude }}
                      pinColor={PIN_HEX[area.pinColor]}
                      testID={`unsafe-area-${area.id}`}
                      onPress={() => setSelectedAreaId(area.id)}
                    />
                    <Circle
                      center={{ latitude: area.latitude, longitude: area.longitude }}
                      radius={area.radiusMeters}
                      strokeColor={PIN_CIRCLE_STROKE[area.pinColor]}
                      fillColor={PIN_CIRCLE_FILL[area.pinColor]}
                    />
                  </React.Fragment>
                ))}
                {nearbyPlaces[activeHelpCategory].map((place) => (
                  <Marker
                    key={`help-${place.id}`}
                    coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                    pinColor={HELP_CATEGORY_COLORS[activeHelpCategory]}
                    title={place.name}
                    description={`${formatDistance(place.distanceKm)} • ${place.address}`}
                    testID={`nearby-marker-${place.id}`}
                  />
                ))}
              </>
            )}
          </MapView>

          <SafeAreaView
            edges={['top', 'left', 'right']}
            pointerEvents="box-none"
            className="absolute inset-x-0 top-0"
          >
            <View className="flex-row items-center justify-between px-4 py-2">
              <Text
                variant="h3"
                tKey="map.title"
                className="rounded-lg border border-stone/20 bg-white/95 px-3 py-1 shadow-sm dark:border-dark-border dark:bg-charcoal/95"
              />
              <Pressable
                onPress={() => setLegendVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={t('map.legend')}
                className="rounded-full border border-stone/20 bg-white/95 p-2 shadow-sm dark:border-dark-border dark:bg-charcoal/95"
              >
                <MaterialIcons
                  name="info-outline"
                  size={ICON_SIZE.ROW}
                  color={colors.textPrimary}
                />
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

          {/* A labelled button rather than an icon-only FAB, and hidden while
            an area card would cover it (BUG-008). */}
          {selectedArea === null && sheetIndex === 0 && (
            <SafeAreaView
              edges={['bottom']}
              pointerEvents="box-none"
              className="absolute inset-x-0 bottom-0 items-end pr-5"
            >
              {/* mb-map-fab = MAP_FAB_OFFSET + MAP_BOTTOM_SHEET_COLLAPSED_CLEARANCE (tailwind.config.js) */}
              <Pressable
                onPress={openReport}
                accessibilityRole="button"
                accessibilityLabel={t('map.reportArea')}
                className="mb-map-fab h-14 flex-row items-center gap-2 rounded-full bg-primary-red px-5 shadow-lg"
              >
                <MaterialIcons name="add-location" size={ICON_SIZE.ROW} color={COLORS.WHITE} />
                <Text variant="label" tKey="map.reportArea" className="text-white" />
              </Pressable>
            </SafeAreaView>
          )}

          {selectedArea !== null && (
            <SafeAreaView edges={['bottom']} className="absolute inset-x-0 bottom-0">
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
                  {t('map.reportAreaCategory')}:{' '}
                  {t(UNSAFE_CATEGORY_LABEL_KEY[selectedArea.category])}
                </Text>

                <View className="mt-3 flex-row items-center gap-3">
                  <Text variant="label" className="flex-1">
                    {t('map.votes', { count: selectedArea.upvotes - selectedArea.downvotes })}
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    label={t('map.upvote')}
                    disabled={hasVoted || votingAreaId !== null}
                    onPress={() => handleVote(selectedArea, 'up')}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    label={t('map.downvote')}
                    disabled={hasVoted || votingAreaId !== null}
                    onPress={() => handleVote(selectedArea, 'down')}
                  />
                </View>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 self-center"
                  label={t('common.close')}
                  onPress={() => setSelectedAreaId(null)}
                />
              </Card>
            </SafeAreaView>
          )}

          {selectedArea === null && (
            <GorhomBottomSheet
              ref={bottomSheetRef}
              index={0}
              snapPoints={NEARBY_SHEET_SNAP_POINTS}
              enableDynamicSizing={false}
              onChange={setSheetIndex}
              backgroundClassName="rounded-t-3xl border border-[#E5E7EB] bg-white dark:border-dark-border dark:bg-charcoal"
              handleIndicatorClassName="w-10 bg-stone"
            >
              <View className="px-4 pb-2 pt-1">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1">
                    <Text
                      variant="label"
                      className="font-semibold text-ink dark:text-white"
                      numberOfLines={1}
                    >
                      {nearestFacilitySummary}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('location.call112')}
                    onPress={() => {
                      void placeCall('112').catch((e: unknown) => {
                        captureException(e);
                        Alert.alert(t('errors.generic'));
                      });
                    }}
                    className="rounded-lg bg-primary-red px-3 py-1.5"
                  >
                    <Text variant="caption" className="font-bold text-white">
                      {t('location.call112')}
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-3 flex-row border-b border-stone/20 pb-2">
                  {HELP_CATEGORIES.map((category) => {
                    const selected = category === activeHelpCategory;
                    return (
                      <Pressable
                        key={category}
                        onPress={() => selectHelpCategory(category)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(HELP_CATEGORY_LABEL_KEY[category])}
                        className={`flex-1 items-center border-b-2 pb-1.5 ${
                          selected ? 'border-shakti-purple' : 'border-transparent'
                        }`}
                      >
                        <MaterialIcons
                          name={HELP_CATEGORY_ICON[category]}
                          size={ICON_SIZE.ROW}
                          color={selected ? COLORS.SHAKTI_PURPLE : COLORS.STONE}
                        />
                        <Text
                          variant="caption"
                          className={`mt-0.5 text-xs ${
                            selected
                              ? 'font-semibold text-shakti-purple'
                              : 'text-stone dark:text-dark-text-secondary'
                          }`}
                          numberOfLines={1}
                        >
                          {t(HELP_CATEGORY_LABEL_KEY[category])}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <BottomSheetScrollView
                contentContainerClassName="px-4 pb-12 pt-1"
                showsVerticalScrollIndicator={false}
              >
                {isFetchingPlaces && nearbyPlaces[activeHelpCategory].length === 0 ? (
                  <Spinner size="md" className="py-6" />
                ) : nearbyPlaces[activeHelpCategory].length === 0 ? (
                  <Text variant="caption" className="py-6 text-center text-stone">
                    {t('location.noPlacesFound')}
                  </Text>
                ) : (
                  nearbyPlaces[activeHelpCategory].map((place) => (
                    <View
                      key={place.id}
                      className="mb-2.5 flex-row items-center justify-between rounded-xl border border-stone/15 bg-white p-3 dark:border-dark-border dark:bg-charcoal"
                    >
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2">
                          <Text variant="label" className="font-semibold" numberOfLines={1}>
                            {place.name}
                          </Text>
                          <Badge variant="info" label={formatDistance(place.distanceKm)} />
                        </View>
                        <Text
                          variant="caption"
                          className="mt-0.5 text-stone dark:text-dark-text-secondary"
                          numberOfLines={1}
                        >
                          {place.address}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {place.phoneNumber !== undefined && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t('location.call')} ${place.name}`}
                            onPress={() => handleCall(place)}
                            className="rounded-lg bg-forest-green p-2"
                          >
                            <MaterialIcons name="call" size={ICON_SIZE.ROW} color={COLORS.WHITE} />
                          </Pressable>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${t('location.directions')} ${place.name}`}
                          onPress={() => handleDirections(place)}
                          className="rounded-lg bg-shakti-purple p-2"
                        >
                          <MaterialIcons
                            name="directions"
                            size={ICON_SIZE.ROW}
                            color={COLORS.WHITE}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </BottomSheetScrollView>
            </GorhomBottomSheet>
          )}

          <BottomSheet visible={isReportModalVisible} onClose={() => setReportModalVisible(false)}>
            <Text variant="h3" tKey="map.reportArea" />
            <Text variant="caption" tKey="map.reportUsesCurrentLocation" className="mt-1" />

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
          </BottomSheet>
        </View>
      </ReplayBlock>
    </ErrorBoundary>
  );
}
