import { Directory, File, Paths } from 'expo-file-system';

import { APP_CONFIG } from '@/constants/config';

/**
 * Offline-first cache for the Information Hub (Phase 6). Admin-curated content
 * (laws, FAQs, tips, news) is written here after every successful Firestore
 * read so the screens keep working with no network after the first load.
 *
 * Storage is a single JSON file per key under `<cache>/surakshak/`. A read
 * never throws — a missing, corrupt, stale, or version-mismatched file just
 * resolves to `null` and the caller falls back to the network.
 */

const CACHE_DIR_NAME = 'surakshak';
const CACHE_VERSION = 1;
const MS_PER_HOUR = 3_600_000;

interface CacheEntry<T> {
  data: T;
  /** Unix epoch milliseconds. */
  cachedAt: number;
  /** Bumped when the on-disk shape changes, to invalidate old caches. */
  version: number;
}

/** Stable file names for each cached content type. */
export const CACHE_KEYS = {
  LAWS: 'laws',
  FAQS: 'faqs',
  TIPS: 'tips',
  NEWS: 'news',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

function cacheDir(): Directory {
  return new Directory(Paths.cache, CACHE_DIR_NAME);
}

function cacheFile(key: string): File {
  return new File(cacheDir(), `${key}.json`);
}

function ensureCacheDir(): void {
  const dir = cacheDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
}

/** Reads a cache entry, or `null` when missing, corrupt, stale, or outdated. */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    ensureCacheDir();
    const file = cacheFile(key);
    if (!file.exists) return null;

    const entry = JSON.parse(await file.text()) as CacheEntry<T>;
    if (entry.version !== CACHE_VERSION) return null;

    const ageHours = (Date.now() - entry.cachedAt) / MS_PER_HOUR;
    if (ageHours > APP_CONFIG.CACHE_EXPIRY_HOURS) return null;

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Persists fresh data for `key`. Failures are swallowed — the cache is
 * best-effort. Returns a promise so call sites can `await` it uniformly even
 * though the underlying file writes are synchronous.
 */
export function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    ensureCacheDir();
    const file = cacheFile(key);
    if (!file.exists) file.create();
    file.write(JSON.stringify({ data, cachedAt: Date.now(), version: CACHE_VERSION }));
  } catch (error) {
    console.warn('Cache write failed:', error);
  }
  return Promise.resolve();
}

/** When `key` was last written, or `null` if it has never been cached. */
export async function getCacheTimestamp(key: string): Promise<Date | null> {
  try {
    const file = cacheFile(key);
    if (!file.exists) return null;
    const entry = JSON.parse(await file.text()) as CacheEntry<unknown>;
    return new Date(entry.cachedAt);
  } catch {
    return null;
  }
}

/** Removes the cache file for `key` if it exists. */
export function clearCache(key: string): Promise<void> {
  try {
    const file = cacheFile(key);
    if (file.exists) file.delete();
  } catch {
    // best-effort — nothing to do if the file is already gone
  }
  return Promise.resolve();
}
