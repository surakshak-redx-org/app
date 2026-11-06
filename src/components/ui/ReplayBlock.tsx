import { MPSessionReplayView } from '@mixpanel/react-native-session-replay';
import * as Sentry from '@sentry/react-native';
import { cssInterop } from 'nativewind';
import React from 'react';
import type { ViewProps } from 'react-native';

interface StyledViewProps extends ViewProps {
  className?: string;
}

// Both vendors' wrappers are plain native views that only take `style`; map
// `className` so the wrapper can carry `flex-1` without an inline style.
cssInterop(Sentry.Mask, { className: 'style' });
cssInterop(MPSessionReplayView, { className: 'style' });

const SentryMask = Sentry.Mask as React.ComponentType<StyledViewProps>;
const MixpanelMask = MPSessionReplayView as React.ComponentType<
  StyledViewProps & { sensitive?: boolean }
>;

export interface ReplayBlockProps {
  children: React.ReactNode;
}

/**
 * Blocks everything inside from session replay in both Sentry and Mixpanel: the
 * region is painted over in the recording, not just its text masked. Use it for
 * screens that reveal where the user is or who they would call -- live location,
 * the map, emergency contacts, SOS, and the disguise calculator.
 */
export function ReplayBlock({ children }: ReplayBlockProps): React.JSX.Element {
  return (
    <SentryMask className="flex-1">
      <MixpanelMask sensitive className="flex-1">
        {children}
      </MixpanelMask>
    </SentryMask>
  );
}
