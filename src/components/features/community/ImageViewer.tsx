import { MaterialIcons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const styles = StyleSheet.create({
  fullSize: {
    height: '100%',
    width: '100%',
  },
});

interface ZoomableImageProps {
  uri: string;
  accessibilityLabel: string;
}

function ZoomableImage({ uri, accessibilityLabel }: ZoomableImageProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        translationX.value = savedTranslationX.value + e.translationX;
        translationY.value = savedTranslationY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslationX.value = translationX.value;
      savedTranslationY.value = translationY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGestures = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        className="h-4/5 w-full items-center justify-center"
      >
        <AnimatedImage
          source={{ uri }}
          style={[styles.fullSize, animatedImageStyle]}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export interface ImageViewerProps {
  /** Single image to show (for backwards compatibility), or `null` to render nothing. */
  uri?: string | null;
  /** Multiple images to paginate through. Takes precedence if non-empty. */
  images?: string[];
  /** Zero-indexed initial image index when opening multi-image array. Defaults to 0. */
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({
  uri,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const imageList = useMemo((): string[] => {
    if (images && images.length > 0) return images;
    if (typeof uri === 'string' && uri.length > 0) return [uri];
    return [];
  }, [images, uri]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex);

  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex);
    setCurrentIndex(initialIndex);
  }

  const currentUri = imageList[currentIndex] ?? imageList[0] ?? '';

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('common.error'), t('community.galleryPermissionRequired'));
        return;
      }

      let localUri = currentUri;
      if (currentUri.startsWith('http://') || currentUri.startsWith('https://')) {
        const ext = currentUri.split('.').pop()?.split('?')[0] ?? 'jpg';
        const targetFile = new File(Paths.cache, `download_${Date.now()}.${ext}`);
        const downloaded = await File.downloadFileAsync(currentUri, targetFile);
        localUri = downloaded.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert(t('common.save'), t('community.imageSaved'));
    } catch (error) {
      captureException(error);
      Alert.alert(t('common.error'), t('community.imageSaveFailed'));
    }
  }, [currentUri, t]);

  const handleShare = useCallback(async (): Promise<void> => {
    try {
      await Share.share({
        url: currentUri,
        message: currentUri,
      });
    } catch (error) {
      captureException(error);
    }
  }, [currentUri]);

  if (imageList.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="none"
        className="flex-1 items-center justify-center bg-near-black/90"
        onPress={onClose}
      >
        <ZoomableImage
          key={currentUri}
          uri={currentUri}
          accessibilityLabel={`Photo ${currentIndex + 1} of ${imageList.length}. Double tap to zoom.`}
        />

        {imageList.length > 1 && (
          <View
            className="absolute inset-x-0 bottom-10 flex-row items-center justify-between px-6"
            pointerEvents="box-none"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous image"
              disabled={currentIndex === 0}
              onPress={(event) => {
                event.stopPropagation?.();
                setCurrentIndex((idx) => Math.max(0, idx - 1));
              }}
              className={`rounded-full border border-white/20 bg-near-black/75 p-3 active:bg-near-black ${
                currentIndex === 0 ? 'opacity-30' : 'opacity-100'
              }`}
            >
              <MaterialIcons name="chevron-left" size={28} color={COLORS.WHITE} />
            </Pressable>

            <View className="rounded-full border border-white/20 bg-near-black/75 px-4 py-1.5">
              <Text className="text-sm font-medium text-white">
                {`${currentIndex + 1} / ${imageList.length}`}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next image"
              disabled={currentIndex === imageList.length - 1}
              onPress={(event) => {
                event.stopPropagation?.();
                setCurrentIndex((idx) => Math.min(imageList.length - 1, idx + 1));
              }}
              className={`rounded-full border border-white/20 bg-near-black/75 p-3 active:bg-near-black ${
                currentIndex === imageList.length - 1 ? 'opacity-30' : 'opacity-100'
              }`}
            >
              <MaterialIcons name="chevron-right" size={28} color={COLORS.WHITE} />
            </Pressable>
          </View>
        )}

        {/* Top Action Bar */}
        <View
          className="absolute inset-x-5 flex-row items-center justify-between"
          style={{ top: Math.max(insets.top, 16) + 12 }}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            className="rounded-full border border-white/20 bg-near-black/75 p-2 active:bg-near-black"
          >
            <MaterialIcons name="close" size={ICON_SIZE.BACK} color={COLORS.WHITE} />
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('community.saveImage')}
              onPress={() => void handleSave()}
              className="rounded-full border border-white/20 bg-near-black/75 p-2 active:bg-near-black"
            >
              <MaterialIcons name="file-download" size={ICON_SIZE.BACK} color={COLORS.WHITE} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.share')}
              onPress={() => void handleShare()}
              className="rounded-full border border-white/20 bg-near-black/75 p-2 active:bg-near-black"
            >
              <MaterialIcons name="share" size={ICON_SIZE.BACK} color={COLORS.WHITE} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
