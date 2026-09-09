import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Every screen is wrapped in this — Surakshak absolute rule 10. A crash in a
 * safety app must never leave the user on a blank screen with no way back.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
    captureException(error);
  }

  // Arrow property, not a method: passing a bound method as a callback prop
  // trips `@typescript-eslint/unbound-method` because the type carries `this`.
  private readonly handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView className="flex-1 bg-off-white">
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.ERROR_RED} />

          <Text variant="h2" tKey="common.error" className="mt-4 text-center" />

          <Text variant="caption" tKey="errors.generic" className="mt-2 text-center" />

          <Button
            variant="primary"
            size="md"
            label="Try again"
            onPress={this.handleRetry}
            className="mt-6"
            accessibilityLabel="Try again"
          />
        </View>
      </SafeAreaView>
    );
  }
}
