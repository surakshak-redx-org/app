import { APP_CONFIG } from '@/constants/config';
import {
  CACHE_KEYS,
  clearCache,
  getCacheTimestamp,
  readCache,
  writeCache,
} from '@/utils/cache.utils';

const mockFileState = {
  exists: false,
  contents: '{}',
  writes: [] as string[],
  created: 0,
  deleted: 0,
};

jest.mock('expo-file-system', () => {
  class MockFile {
    get exists(): boolean {
      return mockFileState.exists;
    }
    text(): Promise<string> {
      return Promise.resolve(mockFileState.contents);
    }
    write(contents: string): void {
      mockFileState.writes.push(contents);
    }
    create(): void {
      mockFileState.created += 1;
    }
    delete(): void {
      mockFileState.deleted += 1;
    }
  }
  class MockDirectory {
    exists = true;
    create(): void {}
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { cache: {} } };
});

function entry(overrides: Partial<{ data: unknown; cachedAt: number; version: number }>): string {
  return JSON.stringify({ data: ['a'], cachedAt: Date.now(), version: 1, ...overrides });
}

describe('cache.utils', () => {
  beforeEach(() => {
    mockFileState.exists = false;
    mockFileState.contents = '{}';
    mockFileState.writes = [];
    mockFileState.created = 0;
    mockFileState.deleted = 0;
  });

  describe('readCache', () => {
    it('returns null when the file does not exist', async () => {
      await expect(readCache(CACHE_KEYS.LAWS)).resolves.toBeNull();
    });

    it('returns null when the cache is older than CACHE_EXPIRY_HOURS', async () => {
      mockFileState.exists = true;
      const stale = Date.now() - (APP_CONFIG.CACHE_EXPIRY_HOURS + 1) * 3_600_000;
      mockFileState.contents = entry({ cachedAt: stale });
      await expect(readCache(CACHE_KEYS.LAWS)).resolves.toBeNull();
    });

    it('returns null on a cache version mismatch', async () => {
      mockFileState.exists = true;
      mockFileState.contents = entry({ version: 99 });
      await expect(readCache(CACHE_KEYS.LAWS)).resolves.toBeNull();
    });

    it('returns null when the file is corrupt', async () => {
      mockFileState.exists = true;
      mockFileState.contents = 'not json';
      await expect(readCache(CACHE_KEYS.LAWS)).resolves.toBeNull();
    });

    it('returns the data for a fresh, current cache entry', async () => {
      mockFileState.exists = true;
      mockFileState.contents = entry({ data: [{ id: 'law_1' }] });
      await expect(readCache(CACHE_KEYS.LAWS)).resolves.toEqual([{ id: 'law_1' }]);
    });
  });

  describe('writeCache', () => {
    it('persists an entry with data, a numeric cachedAt, and the version', async () => {
      await writeCache(CACHE_KEYS.NEWS, [{ id: 'news_1' }]);
      expect(mockFileState.writes).toHaveLength(1);
      const written = JSON.parse(mockFileState.writes[0] ?? '{}') as {
        data: unknown;
        cachedAt: number;
        version: number;
      };
      expect(written.data).toEqual([{ id: 'news_1' }]);
      expect(typeof written.cachedAt).toBe('number');
      expect(written.version).toBe(1);
    });
  });

  describe('clearCache', () => {
    it('deletes the file when it exists', async () => {
      mockFileState.exists = true;
      await clearCache(CACHE_KEYS.NEWS);
      expect(mockFileState.deleted).toBe(1);
    });

    it('does nothing when the file is absent', async () => {
      mockFileState.exists = false;
      await clearCache(CACHE_KEYS.NEWS);
      expect(mockFileState.deleted).toBe(0);
    });
  });

  describe('getCacheTimestamp', () => {
    it('returns null when the file is not found', async () => {
      await expect(getCacheTimestamp(CACHE_KEYS.TIPS)).resolves.toBeNull();
    });

    it('returns the cachedAt as a Date when the file exists', async () => {
      const cachedAt = Date.parse('2026-09-10T10:00:00.000Z');
      mockFileState.exists = true;
      mockFileState.contents = entry({ cachedAt });
      const result = await getCacheTimestamp(CACHE_KEYS.TIPS);
      expect(result).toEqual(new Date(cachedAt));
    });
  });
});
