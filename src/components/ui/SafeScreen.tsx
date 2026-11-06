import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type RefreshControlProps,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReplayBlock } from '@/components/ui/ReplayBlock';

export interface SafeScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /**
   * Paint this screen over in session replay (Sentry and Mixpanel) rather than
   * just masking its text. Set it on any screen that reveals location, contacts,
   * recordings or a phone number.
   */
  blockReplay?: boolean;
}

// iOS never resizes the window for the keyboard on its own — without this,
// a focused input near the bottom of any screen (or the submit button below
// it) ends up hidden behind the keyboard. Android's `windowSoftInputMode`
// (Expo's default is "resize") already handles this at the native level, so
// `behavior` is a no-op there; `undefined` lets RN skip its own handling
// rather than fight the OS resize.
const KEYBOARD_AVOIDING_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

export function SafeScreen({
  children,
  scrollable = false,
  className,
  refreshControl,
  blockReplay = false,
}: SafeScreenProps): React.JSX.Element {
  const body = className === undefined ? 'flex-1 px-4' : `flex-1 px-4 ${className}`;

  const screen = (
    <SafeAreaView
      className="flex-1 bg-off-white dark:bg-near-black"
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView className="flex-1" behavior={KEYBOARD_AVOIDING_BEHAVIOR}>
        {scrollable ? (
          <ScrollView
            className={body}
            contentContainerClassName="pb-8"
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View className={body}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return blockReplay ? <ReplayBlock>{screen}</ReplayBlock> : screen;
}
