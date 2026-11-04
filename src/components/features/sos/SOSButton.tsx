import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PULSE_MIN_SCALE = 1;
const PULSE_MAX_SCALE = 1.08;
const PULSE_DURATION_MS = 900;

export interface SOSButtonProps {
  onTrigger: () => void;
  disabled?: boolean;
  tapCount?: number;
}

export function SOSButton({
  onTrigger,
  disabled = false,
  tapCount = 0,
}: SOSButtonProps): React.JSX.Element {
  const scale = useSharedValue(PULSE_MIN_SCALE);

  useEffect(() => {
    if (disabled) {
      cancelAnimation(scale);
      scale.value = PULSE_MIN_SCALE;
      return;
    }

    scale.value = withRepeat(
      withTiming(PULSE_MAX_SCALE, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    return (): void => {
      cancelAnimation(scale);
    };
  }, [disabled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onTrigger();
  }

  return (
    <AnimatedPressable
      style={animatedStyle}
      className="h-[128px] w-[128px] items-center justify-center rounded-full bg-primary-red shadow-lg"
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="SOS Emergency Button"
      accessibilityHint="Tap 3 times quickly to send emergency alert"
      accessibilityState={{ disabled }}
    >
      <Text variant="h1" tKey="home.sos" className="text-white" />
      <View className="mt-1 flex-row items-center gap-1.5" testID="sos-tap-pips">
        <View className={`h-2 w-2 rounded-full ${tapCount >= 1 ? 'bg-white' : 'bg-white/30'}`} />
        <View className={`h-2 w-2 rounded-full ${tapCount >= 2 ? 'bg-white' : 'bg-white/30'}`} />
        <View className={`h-2 w-2 rounded-full ${tapCount >= 3 ? 'bg-white' : 'bg-white/30'}`} />
      </View>
    </AnimatedPressable>
  );
}
