import { useCallback, useEffect, useMemo, useState } from 'react';

import { captureException } from '@/config/sentry';
import { getCacheTimestamp, readCache } from '@/utils/cache.utils';

export interface InfoContent<T> {
  items: T[];
  categories: string[];
  isLoading: boolean;
  /** A pull-to-refresh is in flight. */
  isRefreshing: boolean;
  /** A fetch failed and there is no cached content to fall back on. */
  hasError: boolean;
  /** Serving cached content because the last refresh failed. */
  isOffline: boolean;
  /** When the shown content was last cached, or `null` if never. */
  lastSyncDate: Date | null;
  /** Re-run the initial load (used by the error-state retry button). */
  reload: () => void;
  /** Re-fetch from the network (pull-to-refresh). */
  refresh: () => void;
}

/** The `categoryOf` every Information Hub collection uses — stable, module-level. */
export function byCategory(item: { category: string }): string {
  return item.category;
}

/**
 * Shared load/refresh/offline plumbing for the four Information Hub list
 * screens: paints the cached copy straight away, then replaces it with the
 * network result — so an admin edit shows up the next time the screen opens
 * (BUG-002 / BUG-003) — and keeps the cached copy, flagged offline, when the
 * network fails. `fetchItems` must be a stable, network-backed reference
 * that writes `cacheKey` on success; `categoryOf` must be stable too.
 */
export function useInfoContent<T>(
  fetchItems: () => Promise<T[]>,
  categoryOf: (item: T) => string,
  cacheKey: string,
): InfoContent<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const cached = await readCache<T[]>(cacheKey, { allowStale: true });
      if (cancelled) return;
      if (cached !== null) {
        setItems(cached);
        setLastSyncDate(await getCacheTimestamp(cacheKey));
        if (!cancelled) setIsLoading(false);
      }

      try {
        const fresh = await fetchItems();
        if (cancelled) return;
        setItems(fresh);
        setLastSyncDate(new Date());
        setIsOffline(false);
        setHasError(false);
      } catch (error) {
        if (cancelled) return;
        captureException(error);
        if (cached !== null) setIsOffline(true);
        else setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return (): void => {
      cancelled = true;
    };
  }, [fetchItems, cacheKey, nonce]);

  const reload = useCallback((): void => {
    setIsLoading(true);
    setNonce((value): number => value + 1);
  }, []);

  const refresh = useCallback((): void => {
    setIsRefreshing(true);
    fetchItems()
      .then((fresh) => {
        setItems(fresh);
        setLastSyncDate(new Date());
        setIsOffline(false);
        setHasError(false);
      })
      .catch((error: unknown) => {
        captureException(error);
        setIsOffline(true);
      })
      .finally(() => setIsRefreshing(false));
  }, [fetchItems]);

  const categories = useMemo(() => [...new Set(items.map(categoryOf))].sort(), [items, categoryOf]);

  return {
    items,
    categories,
    isLoading,
    isRefreshing,
    hasError,
    isOffline,
    lastSyncDate,
    reload,
    refresh,
  };
}
