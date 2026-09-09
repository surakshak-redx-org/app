// TODO: Implemented in Phase 7 — Advanced Safety
import React from 'react';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';

export default function SilentRecordingScreen(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeScreen>
        <Text variant="h1" tKey="screens.silentRecording" className="mt-4" />
        <Text variant="body" tKey="common.comingSoon" className="mt-2" />
      </SafeScreen>
    </ErrorBoundary>
  );
}
