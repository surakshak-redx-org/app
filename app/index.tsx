import { Redirect } from 'expo-router';
import React from 'react';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ROUTES } from '@/constants/routes';
import { useDisguiseStore } from '@/stores/disguise.store';

/**
 * The root route only decides where to go. Whether the user is actually
 * allowed into the tabs is enforced by the redirect effect in `app/_layout.tsx`.
 * With Disguise Mode on, a cold start goes straight to the calculator
 * instead of passing through Home first (BUG-024).
 */
export default function IndexScreen(): React.JSX.Element {
  const showCalculator = useDisguiseStore(
    (state) => state.isEnabled === true && !state.isUnlockedThisSession,
  );
  return (
    <ErrorBoundary>
      <Redirect href={showCalculator ? ROUTES.CALCULATOR : ROUTES.HOME} />
    </ErrorBoundary>
  );
}
