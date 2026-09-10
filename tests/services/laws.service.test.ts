import { getDoc, getDocs } from '@react-native-firebase/firestore';

import {
  getFaqCategories,
  getFaqs,
  getLawById,
  getLawCategories,
  getLaws,
  getSafetyTipCategories,
  getSafetyTips,
} from '@/services/firebase/laws.service';
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

  it('getLaws returns cached data without awaiting the network', async () => {
    jest.mocked(readCache).mockResolvedValueOnce([LAW]);
    await expect(getLaws()).resolves.toEqual([LAW]);
  });

  it('getLaws fetches from Firestore and writes the cache on a cold cache', async () => {
    jest.mocked(readCache).mockResolvedValueOnce(null);
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([LAW]) as never);

    const result = await getLaws();

    expect(result).toEqual([LAW]);
    expect(writeCache).toHaveBeenCalledWith('laws', [LAW]);
  });

  it('getLawById resolves from the cached list without a Firestore read', async () => {
    jest.mocked(readCache).mockResolvedValueOnce([LAW]);
    await expect(getLawById('law_1')).resolves.toEqual(LAW);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('getLawById falls back to Firestore when the id is not cached', async () => {
    jest.mocked(readCache).mockResolvedValueOnce([LAW]);
    const other = { ...LAW, id: 'law_2', title: 'POCSO' };
    const { id: _id, ...rest } = other;
    jest.mocked(getDoc).mockResolvedValueOnce(snap(rest) as never);

    await expect(getLawById('law_2')).resolves.toMatchObject({ id: 'law_1', title: 'POCSO' });
    expect(getDoc).toHaveBeenCalled();
  });

  it('getLawById returns null when the document is missing', async () => {
    jest.mocked(readCache).mockResolvedValueOnce(null);
    jest.mocked(getDoc).mockResolvedValueOnce(snap(undefined) as never);
    await expect(getLawById('nope')).resolves.toBeNull();
  });

  it('getFaqs returns the cache when present', async () => {
    const faq = {
      id: 'faq_1',
      question: 'Q',
      answer: 'A',
      category: 'Legal Help',
      order: 1,
      isPublished: true,
    };
    jest.mocked(readCache).mockResolvedValueOnce([faq]);
    await expect(getFaqs()).resolves.toEqual([faq]);
  });

  it('getSafetyTips fetches and caches from Firestore when the cache is cold', async () => {
    const tip = {
      id: 'tip_1',
      title: 'T',
      content: 'C',
      category: 'Travel',
      order: 1,
      isPublished: true,
    };
    jest.mocked(readCache).mockResolvedValueOnce(null);
    const { id: _id, ...rest } = tip;
    jest.mocked(getDocs).mockResolvedValueOnce(docsFrom([{ id: 'tip_1', ...rest }]) as never);

    await expect(getSafetyTips()).resolves.toEqual([tip]);
    expect(writeCache).toHaveBeenCalledWith('tips', [tip]);
  });

  it('getLawCategories returns unique, sorted categories', async () => {
    jest.mocked(readCache).mockResolvedValueOnce([
      { ...LAW, id: 'a', category: 'Workplace Safety' },
      { ...LAW, id: 'b', category: 'Domestic Safety' },
      { ...LAW, id: 'c', category: 'Workplace Safety' },
    ]);
    await expect(getLawCategories()).resolves.toEqual(['Domestic Safety', 'Workplace Safety']);
  });

  it('getFaqCategories and getSafetyTipCategories dedupe and sort', async () => {
    jest.mocked(readCache).mockResolvedValueOnce([
      { id: 'f1', question: 'Q', answer: 'A', category: 'Emergency', order: 1, isPublished: true },
      { id: 'f2', question: 'Q', answer: 'A', category: 'App Help', order: 2, isPublished: true },
    ]);
    await expect(getFaqCategories()).resolves.toEqual(['App Help', 'Emergency']);

    jest.mocked(readCache).mockResolvedValueOnce([
      { id: 't1', title: 'T', content: 'C', category: 'Online', order: 1, isPublished: true },
      { id: 't2', title: 'T', content: 'C', category: 'Home', order: 2, isPublished: true },
    ]);
    await expect(getSafetyTipCategories()).resolves.toEqual(['Home', 'Online']);
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
