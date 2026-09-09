import { Redirect } from 'expo-router';
import React from 'react';

import { ROUTES } from '@/constants/routes';

/**
 * The root route only decides where to go. Whether the user is actually
 * allowed into the tabs is enforced by the redirect effect in `app/_layout.tsx`.
 */
export default function IndexScreen(): React.JSX.Element {
  return <Redirect href={ROUTES.HOME} />;
}
