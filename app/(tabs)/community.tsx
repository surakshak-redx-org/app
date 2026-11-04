import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { GuestBanner } from '@/components/features/auth/GuestBanner';
import { ImageViewer } from '@/components/features/community/ImageViewer';
import { PostCard } from '@/components/features/community/PostCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG, COMMUNITY_IMAGE_ASPECT } from '@/constants/config';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import { useCommunity } from '@/hooks/useCommunity';
import { useTheme } from '@/hooks/useTheme';
import { getCurrentLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  CommunityPost,
  CommunityTab,
  CreatePostInput,
  PostType,
} from '@/types/community.types';
import { toMillis } from '@/utils/date.utils';
import { getLocationUrl } from '@/utils/location.utils';
import { placeCall } from '@/utils/phone.utils';

export type TopicFilter = 'all' | 'incident' | 'help_request' | 'discussion';

interface FilterOption {
  key: TopicFilter;
  labelKey: string;
}

const FILTER_OPTIONS: readonly FilterOption[] = [
  { key: 'all', labelKey: 'community.filterAll' },
  { key: 'incident', labelKey: 'community.filterSafetyAlerts' },
  { key: 'help_request', labelKey: 'community.filterHelpRequests' },
  { key: 'discussion', labelKey: 'community.filterDiscussions' },
];

const MS_IN_72_HOURS = 72 * 60 * 60 * 1000;

const TABS: readonly CommunityTab[] = ['city', 'all_india'];

const TYPE_ICON: Record<PostType, keyof typeof MaterialIcons.glyphMap> = {
  text: 'chat',
  location: 'place',
  image: 'image',
  help_request: 'sos',
  incident: 'warning',
};

const TYPE_LABEL_KEY: Record<PostType, string> = {
  text: 'community.textPost',
  location: 'community.shareLocation',
  image: 'community.shareImage',
  help_request: 'community.helpRequest',
  incident: 'community.incidentAlert',
};

export default function CommunityScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const isGuest = useAuthStore((state) => state.isGuest);
  const surakshakUser = useAuthStore((state) => state.surakshakUser);
  const city = surakshakUser?.city ?? '';
  const state = surakshakUser?.state ?? '';

  const {
    posts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    activeTab,
    setActiveTab,
    refresh,
    createPost,
    reportPost,
    deletePost,
    currentUserId,
    loadMore,
    uploadImage,
  } = useCommunity();

  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const [now] = useState(() => Date.now());
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [postType, setPostType] = useState<PostType>('text');
  const [locationUrl, setLocationUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [isDisclaimerDismissed, setIsDisclaimerDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.COMMUNITY_DISCLAIMER_DISMISSED)
      .then((val) => {
        if (val === STORAGE_FLAG_ON) {
          setIsDisclaimerDismissed(true);
        }
      })
      .catch((err: unknown) => captureException(err));
  }, []);

  const dismissDisclaimer = useCallback((): void => {
    setIsDisclaimerDismissed(true);
    AsyncStorage.setItem(STORAGE_KEYS.COMMUNITY_DISCLAIMER_DISMISSED, STORAGE_FLAG_ON).catch(
      (err: unknown) => captureException(err),
    );
  }, []);

  const filteredPosts = useMemo(() => {
    if (topicFilter === 'all') {
      return posts;
    }
    return posts.filter((post) => {
      if (topicFilter === 'incident') {
        if (post.type !== 'incident') return false;
        const createdMillis = toMillis(post.createdAt);
        return createdMillis === null || now - createdMillis <= MS_IN_72_HOURS;
      }
      if (topicFilter === 'help_request') {
        return post.type === 'help_request';
      }
      if (topicFilter === 'discussion') {
        return post.type === 'text' || post.type === 'image' || post.type === 'location';
      }
      return true;
    });
  }, [now, posts, topicFilter]);

  const closeCompose = (): void => {
    setComposeOpen(false);
    setContent('');
    setIsAnonymous(false);
    setPostType('text');
    setLocationUrl(null);
    setImageUrl(null);
  };

  const handleAttachLocation = async (): Promise<void> => {
    try {
      const fix = await getCurrentLocation();
      setLocationUrl(getLocationUrl(fix.latitude, fix.longitude));
      setImageUrl(null);
      setPostType('location');
    } catch (e) {
      captureException(e);
      Alert.alert(t('errors.locationPermissionDenied'));
    }
  };

  const handleAttachImage = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: COMMUNITY_IMAGE_ASPECT,
      quality: APP_CONFIG.COMMUNITY_IMAGE_QUALITY,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return;

    setIsUploading(true);
    try {
      const url = await uploadImage(asset.uri);
      setImageUrl(url);
      setLocationUrl(null);
      setPostType('image');
    } catch (e) {
      captureException(e);
      Alert.alert(t('errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const selectType = (type: PostType): void => {
    if (type === 'location') {
      void handleAttachLocation();
      return;
    }
    if (type === 'image') {
      void handleAttachImage();
      return;
    }
    setLocationUrl(null);
    setImageUrl(null);
    setPostType(type);
  };

  const handleSubmit = async (): Promise<void> => {
    const input: CreatePostInput = {
      content: content.trim(),
      type: postType,
      isAnonymous,
      city,
      state,
      ...(postType === 'location' && locationUrl !== null ? { locationUrl } : {}),
      ...(postType === 'image' && imageUrl !== null ? { imageUrl } : {}),
    };

    setIsPosting(true);
    try {
      await createPost(input);
      closeCompose();
    } catch (e) {
      captureException(e);
      Alert.alert(t('errors.generic'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleReportPress = (postId: string): void => {
    if (isGuest || currentUserId === null) {
      Alert.alert(t('community.guestPrompt'));
      return;
    }
    Alert.alert(t('community.reportConfirmTitle'), t('community.reportConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.reportAction'),
        style: 'destructive',
        onPress: (): void => {
          void reportPost(postId)
            .then(() => Alert.alert(t('community.reported')))
            .catch((e: unknown) => {
              captureException(e);
              Alert.alert(t('errors.generic'));
            });
        },
      },
    ]);
  };

  const handleDeletePress = (post: CommunityPost): void => {
    Alert.alert(t('community.deleteConfirmTitle'), t('community.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.deletePost'),
        style: 'destructive',
        onPress: (): void => {
          void deletePost(post).catch((e: unknown) => {
            captureException(e);
            Alert.alert(t('community.deleteFailed'));
          });
        },
      },
    ]);
  };

  const openAttachedLocation = (): void => {
    if (locationUrl === null) return;
    Linking.openURL(locationUrl).catch((e: unknown) => captureException(e));
  };

  function renderBody(): React.JSX.Element {
    if (isGuest) {
      return (
        <View className="mt-4 flex-1">
          <GuestBanner message={t('community.guestPrompt')} />
          <EmptyState
            icon="chatbubbles-outline"
            title={t('community.noMessages')}
            subtitle={t('community.beFirst')}
          />
        </View>
      );
    }

    if (error !== null) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title={t('community.loadError')}
          actionLabel={t('common.retry')}
          onAction={refresh}
        />
      );
    }

    if (isLoading) {
      return <Spinner size="lg" className="flex-1 items-center justify-center" />;
    }

    return (
      <FlatList
        testID="community-feed-list"
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isGuest={isGuest}
            isOwn={currentUserId !== null && item.authorId === currentUserId}
            onReport={handleReportPress}
            onDelete={handleDeletePress}
            onOpenImage={setViewerUri}
          />
        )}
        onEndReached={() => {
          void loadMore();
        }}
        onEndReachedThreshold={0.5}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        contentContainerClassName="pb-24 pt-3"
        ListEmptyComponent={
          posts.length > 0 ? (
            <EmptyState
              icon="filter-outline"
              title={t('community.noFilterResults')}
              subtitle={t('community.tryDifferentFilter')}
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={t('community.noMessages')}
              subtitle={t('community.beFirst')}
            />
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <Spinner className="py-4" />
          ) : !hasMore && filteredPosts.length > 0 ? (
            <Text variant="caption" className="py-4 text-center">
              {t('community.caughtUp')}
            </Text>
          ) : null
        }
      />
    );
  }

  return (
    <ErrorBoundary>
      <SafeScreen>
        <View className="border-b border-stone/20 pb-2">
          {/* Emergency Sticky Disclaimer Banner */}
          {!isDisclaimerDismissed && (
            <View
              accessibilityRole="alert"
              className="mb-2 flex-row items-center justify-between rounded-xl border border-primary-red/30 bg-primary-red/10 p-2.5"
            >
              <MaterialIcons name="warning" size={ICON_SIZE.ROW} color={COLORS.PRIMARY_RED} />
              <Text variant="caption" className="mx-2 flex-1 font-medium text-primary-red">
                {t('community.emergencyDisclaimer')}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="SOS"
                  onPress={() => router.push(ROUTES.HOME)}
                  className="rounded-md bg-shakti-purple px-2 py-1"
                >
                  <Text variant="caption" className="font-bold text-white">
                    {t('community.tapSos')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('community.call112')}
                  onPress={() => {
                    void placeCall('112').catch((e: unknown) => {
                      captureException(e);
                      Alert.alert(t('errors.generic'));
                    });
                  }}
                  className="rounded-md bg-primary-red px-2 py-1"
                >
                  <Text variant="caption" className="font-bold text-white">
                    {t('community.call112')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('community.dismissDisclaimer')}
                  onPress={dismissDisclaimer}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="ml-0.5 p-1"
                >
                  <MaterialIcons name="close" size={ICON_SIZE.DISMISS} color={COLORS.PRIMARY_RED} />
                </Pressable>
              </View>
            </View>
          )}

          <Text variant="h2" tKey="community.title" className="mt-1" />
          {city.length > 0 && <Text variant="caption">{city}</Text>}
          <View className="mt-2 flex-row">
            {TABS.map((tab) => {
              const selected = tab === activeTab;
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 items-center py-2 ${
                    selected ? 'border-b-2 border-shakti-purple' : ''
                  }`}
                >
                  <Text variant="label" className={selected ? 'text-shakti-purple' : ''}>
                    {t(tab === 'city' ? 'community.myCity' : 'community.allIndia')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Horizontal Topic Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="flex-row gap-2 pt-2.5 pb-1"
          >
            {FILTER_OPTIONS.map((filter) => {
              const selected = filter.key === topicFilter;
              return (
                <Pressable
                  key={filter.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(filter.labelKey)}
                  onPress={() => setTopicFilter(filter.key)}
                  className={`rounded-full px-3 py-1.5 ${
                    selected ? 'bg-shakti-purple' : 'bg-stone/10 dark:bg-stone/20'
                  }`}
                >
                  <Text
                    variant="caption"
                    className={`font-semibold ${selected ? 'text-white' : 'text-stone dark:text-dark-text-primary'}`}
                  >
                    {t(filter.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {renderBody()}

        {!isGuest && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('community.compose')}
            onPress={() => setComposeOpen(true)}
            className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary-red shadow-lg"
          >
            <MaterialIcons name="add" size={ICON_SIZE.PERMISSION} color={COLORS.WHITE} />
          </Pressable>
        )}

        <BottomSheet visible={composeOpen} onClose={closeCompose}>
          <Text variant="h2" tKey="community.compose" className="mb-3" />

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text variant="label" tKey="community.anonymous" />
              <Text variant="caption">
                {t(isAnonymous ? 'community.anonymousOn' : 'community.anonymousOff')}
              </Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ true: COLORS.SHAKTI_PURPLE, false: COLORS.STONE }}
            />
          </View>

          <View className="mt-4 flex-row gap-3">
            {(Object.keys(TYPE_ICON) as PostType[]).map((type) => {
              const selected = postType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(TYPE_LABEL_KEY[type])}
                  onPress={() => selectType(type)}
                  className={`rounded-xl p-3 ${selected ? 'bg-shakti-purple' : 'bg-stone/10'}`}
                >
                  <MaterialIcons
                    name={TYPE_ICON[type]}
                    size={ICON_SIZE.ROW}
                    color={selected ? COLORS.WHITE : COLORS.STONE}
                  />
                </Pressable>
              );
            })}
          </View>

          {isUploading && (
            <Text variant="caption" className="mt-3" tKey="community.uploadingImage" />
          )}
          {imageUrl !== null && (
            <Image source={{ uri: imageUrl }} className="mt-3 h-24 w-24 rounded-lg" />
          )}
          {locationUrl !== null && (
            <Pressable
              accessibilityRole="link"
              onPress={openAttachedLocation}
              className="mt-3 flex-row items-center gap-1 self-start"
            >
              <MaterialIcons name="place" size={ICON_SIZE.ROW} color={COLORS.SHAKTI_PURPLE} />
              <Text variant="caption" className="text-shakti-purple" tKey="community.viewOnMap" />
            </Pressable>
          )}

          <TextInput
            multiline
            maxLength={APP_CONFIG.COMMUNITY_POST_MAX_LENGTH}
            placeholder={t('community.typeMessage')}
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            className="mt-3 min-h-24 rounded-xl border border-stone/30 bg-white p-3 text-base text-ink dark:border-dark-border dark:bg-charcoal dark:text-white"
          />
          <Text variant="caption" className="mt-1 self-end">
            {t('community.charCount', {
              count: content.length,
              max: APP_CONFIG.COMMUNITY_POST_MAX_LENGTH,
            })}
          </Text>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-3"
            label={t('community.post')}
            loading={isPosting}
            disabled={content.trim().length === 0 || isUploading}
            onPress={() => {
              void handleSubmit();
            }}
          />
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="mt-2"
            label={t('common.cancel')}
            onPress={closeCompose}
          />
        </BottomSheet>

        <ImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
      </SafeScreen>
    </ErrorBoundary>
  );
}
