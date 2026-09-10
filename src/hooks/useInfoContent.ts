import { useCallback, useEffect, useState } from 'react';

import { captureException } from '@/config/sentry';
import { getCacheTimestamp } from '@/utils/cache.utils';

export interface InfoContent<T> {
  items: T[];
  categories: string[];
  isLoading: boolean;
  /** A fetch failed and there is no cached content to fall back on. */
  hasError: boolean;
  /** Serving cached content because the last refresh failed. */
  isOffline: boolean;
  /** When the shown content was last cached, or `null` if never. */
  lastSyncDate: Date | null;
  /** Re-run the initial load (used by the error-state retry button). */
  reload: () => void;
  /** Replace items after a manual refresh (e.g. pull-to-refresh). */
  setItems: (items: T[]) => void;
  setLastSyncDate: (date: Date | null) => void;
  setIsOffline: (offline: boolean) => void;
}

/**
 * Shared load/refresh/offline plumbing for the four Information Hub list
 * screens. `fetchItems` and `fetchCategories` must be stable references
 * (module-level service functions); `cacheKey` is one of `CACHE_KEYS`.
 */
export function useInfoContent<T>(
  fetchItems: () => Promise<T[]>,
  fetchCategories: () => Promise<string[]>,
  cacheKey: string,
): InfoContent<T> {
  const [items, setItems] = useState<T[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  const loadAll = useCallback(
    () => Promise.all([fetchItems(), fetchCategories(), getCacheTimestamp(cacheKey)]),
    [fetchItems, fetchCategories, cacheKey],
  );

  useEffect(() => {
    let cancelled = false;
    void loadAll()
      .then(([nextItems, nextCategories, syncedAt]) => {
        if (cancelled) return;
        setItems(nextItems);
        setCategories(nextCategories);
        setLastSyncDate(syncedAt);
        setIsOffline(false);
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        captureException(error);
        setHasError(true);
        setIsOffline(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [loadAll, nonce]);

  const reload = useCallback((): void => {
    setIsLoading(true);
    setNonce((value): number => value + 1);
  }, []);

  return {
    items,
    categories,
    isLoading,
    hasError,
    isOffline,
    lastSyncDate,
    reload,
    setItems,
    setLastSyncDate,
    setIsOffline,
  };
}
