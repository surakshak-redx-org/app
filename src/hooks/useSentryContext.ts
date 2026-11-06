import { useEffect } from 'react';

import { setSentryTags, setSentryUser } from '@/config/sentry';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Keeps Sentry's user and tags in step with the auth state, so every event is
 * attributable (UID only -- never phone or name) and filterable by guest status
 * and app language. Derived from the store rather than set at each sign-in
 * site, so sign-out and guest conversion clear or update it automatically.
 */
export function useSentryContext(): void {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const isGuest = useAuthStore((state) => state.isGuest);
  const language = useAuthStore((state) => state.surakshakUser?.language);

  useEffect(() => {
    setSentryUser(uid);
  }, [uid]);

  useEffect(() => {
    setSentryTags({
      is_guest: String(isGuest),
      ...(language !== undefined ? { language } : {}),
    });
  }, [isGuest, language]);
}
