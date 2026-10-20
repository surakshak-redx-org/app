import React from 'react';

import { SOSCountdownOverlay } from '@/components/features/sos/SOSCountdownOverlay';
import { useSOS } from '@/hooks/useSOS';
import { useDisguiseStore } from '@/stores/disguise.store';

/**
 * Root-level overlay mounted in `app/_layout.tsx` so the SOS countdown and
 * cancellation action are accessible across all screens and tabs, including
 * when SOS is activated remotely via suspicious-follow or shake detection.
 */
export function GlobalSOSOverlay(): React.JSX.Element | null {
  const { isActive, countdown, isSending, cancel } = useSOS();
  // Never paint the bright SOS UI over the Disguise Mode calculator (BUG-108).
  const isCalculatorShowing = useDisguiseStore(
    (state) => state.isEnabled === true && !state.isUnlockedThisSession,
  );

  if (!isActive || isCalculatorShowing) return null;

  return <SOSCountdownOverlay countdown={countdown} isSending={isSending} onCancel={cancel} />;
}
