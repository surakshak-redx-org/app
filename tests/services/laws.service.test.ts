import { getDoc, getDocs } from '@react-native-firebase/firestore';

import { getFaqs, getLawById, getLaws, getSafetyTips } from '@/services/firebase/laws.service';
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

const LAW = {
  id: 'law_1',
  title: 'Domestic Violence Act',
  shortDescription: 'Protects women at home.',
  fullContent: 'Full text.',
  category: 'Domestic Safety',
  tags: ['abuse'],
  order: 1,
  isPublished: true,
};

const docsFrom = (rows: { id: string; [key: string]: unknown }[]): unknown => ({
  docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })),
});

const snap = (data: unknown): unknown => ({
  exists: () => data !== undefined,
  id: 'law_1',
  data: () => data,
});

describe('laws.service', () => {
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

  it('getLaws always reads Firestore, so admin edits show up, and refreshes the cache', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([LAW]) as never);

    await expect(getLaws()).resolves.toEqual([LAW]);
    expect(getDocs).toHaveBeenCalled();
    expect(readCache).not.toHaveBeenCalled();
    expect(writeCache).toHaveBeenCalledWith('laws', [LAW]);
  });

  it('getLawById reads Firestore first', async () => {
    const { id: _id, ...rest } = LAW;
    jest.mocked(getDoc).mockResolvedValueOnce(snap({ ...rest, title: 'Edited' }) as never);

    await expect(getLawById('law_1')).resolves.toMatchObject({ id: 'law_1', title: 'Edited' });
    expect(readCache).not.toHaveBeenCalled();
  });

  it('getLawById falls back to the cached list when Firestore fails', async () => {
    jest.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(readCache).mockResolvedValueOnce([LAW]);

    await expect(getLawById('law_1')).resolves.toEqual(LAW);
    expect(readCache).toHaveBeenCalledWith('laws', { allowStale: true });
  });

  it('getLawById returns null when the document is missing', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(snap(undefined) as never);
    await expect(getLawById('nope')).resolves.toBeNull();
  });

  it('getFaqs and getSafetyTips fetch and cache from Firestore', async () => {
    const faq = {
      id: 'faq_1',
      question: 'Q',
      answer: 'A',
      category: 'Legal Help',
      order: 1,
      isPublished: true,
    };
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([faq]) as never);
    await expect(getFaqs()).resolves.toEqual([faq]);
    expect(writeCache).toHaveBeenCalledWith('faqs', [faq]);

    const tip = {
      id: 'tip_1',
      title: 'T',
      content: 'C',
      category: 'Travel',
      order: 1,
      isPublished: true,
    };
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([tip]) as never);
    await expect(getSafetyTips()).resolves.toEqual([tip]);
    expect(writeCache).toHaveBeenCalledWith('tips', [tip]);
  });

  it.each([
    ['getLaws', (): Promise<unknown> => getLaws()],
    ['getSafetyTips', (): Promise<unknown> => getSafetyTips()],
    ['getFaqs', (): Promise<unknown> => getFaqs()],
    ['getLawById', (): Promise<unknown> => getLawById('law_1')],
  ])('%s logs and rethrows when Firestore fails', async (_name, call) => {
    jest.mocked(readCache).mockResolvedValue(null);
    jest.mocked(getDocs).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(call()).rejects.toThrow('offline');
    expect(errorSpy).toHaveBeenCalled();
  });
});
