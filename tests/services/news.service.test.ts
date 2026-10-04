import { getDoc, getDocs, limit, orderBy } from '@react-native-firebase/firestore';

import { getNews, getNewsById } from '@/services/firebase/news.service';
import { readCache, writeCache } from '@/utils/cache.utils';

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
  doc: jest.fn((...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, direction: string) => ({ orderBy: field, direction })),
  limit: jest.fn((n: number) => ({ limit: n })),
}));

jest.mock('@/utils/cache.utils', () => ({
  CACHE_KEYS: { LAWS: 'laws', FAQS: 'faqs', TIPS: 'tips', NEWS: 'news' },
  readCache: jest.fn(),
  writeCache: jest.fn(() => Promise.resolve()),
  getCacheTimestamp: jest.fn(() => Promise.resolve(null)),
  clearCache: jest.fn(() => Promise.resolve()),
}));

const ARTICLE = {
  id: 'news_1',
  title: 'Surakshak launches',
  summary: 'A new safety app.',
  content: 'Full story.',
  imageUrl: '',
  category: 'App News',
  publishedAt: 1_757_500_000_000,
  isPublished: true,
};

const docsFrom = (rows: { id: string; [key: string]: unknown }[]): unknown => ({
  docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })),
});

const snap = (data: unknown): unknown => ({
  exists: () => data !== undefined,
  id: 'news_1',
  data: () => data,
});

describe('news.service', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('getNews fetches newest-first with a limit and writes the cache', async () => {
    const { id: _id, ...rest } = ARTICLE;
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([{ id: 'news_1', ...rest }]) as never);

    await expect(getNews(30)).resolves.toEqual([ARTICLE]);
    expect(orderBy).toHaveBeenCalledWith('publishedAt', 'desc');
    expect(limit).toHaveBeenCalledWith(30);
    expect(writeCache).toHaveBeenCalledWith('news', [ARTICLE]);
  });

  it('converts the Firestore Timestamp the admin writes into epoch millis', async () => {
    const { id: _id, publishedAt, ...rest } = ARTICLE;
    jest
      .mocked(getDocs)
      .mockResolvedValueOnce(
        docsFrom([
          { id: 'news_1', ...rest, publishedAt: { toMillis: () => publishedAt } },
        ]) as never,
      );

    const [article] = await getNews(30);

    expect(article?.publishedAt).toBe(publishedAt);
    expect(Number.isNaN(new Date(article?.publishedAt ?? Number.NaN).getTime())).toBe(false);
  });

  it('getNewsById reads Firestore first and converts the timestamp', async () => {
    const { id: _id, publishedAt, ...rest } = ARTICLE;
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snap({ ...rest, publishedAt: { seconds: publishedAt / 1000 } }) as never,
      );

    await expect(getNewsById('news_1')).resolves.toEqual(ARTICLE);
    expect(readCache).not.toHaveBeenCalled();
  });

  it('getNewsById falls back to the cached list when Firestore fails', async () => {
    jest.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(readCache).mockResolvedValueOnce([ARTICLE]);

    await expect(getNewsById('news_1')).resolves.toEqual(ARTICLE);
  });

  it('getNewsById returns null when missing', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(snap(undefined) as never);
    await expect(getNewsById('gone')).resolves.toBeNull();
  });

  it.each([
    ['getNews', (): Promise<unknown> => getNews(30)],
    ['getNewsById', (): Promise<unknown> => getNewsById('news_1')],
  ])('%s logs and rethrows when Firestore fails', async (_name, call) => {
    jest.mocked(readCache).mockResolvedValue(null);
    jest.mocked(getDocs).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(call()).rejects.toThrow('offline');
    expect(errorSpy).toHaveBeenCalled();
  });
});
