import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface SafeScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}

export function SafeScreen({
  children,
  scrollable = false,
  className,
}: SafeScreenProps): React.JSX.Element {
  const body = className === undefined ? 'flex-1 px-4' : `flex-1 px-4 ${className}`;

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'left', 'right']}>
      {scrollable ? (
        <ScrollView
          className={body}
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={body}>{children}</View>
      )}
    </SafeAreaView>
  );
}
