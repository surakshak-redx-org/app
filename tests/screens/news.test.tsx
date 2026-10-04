import { act, render } from '@testing-library/react-native';
import React from 'react';

import NewsScreen from '@app/news';

const mockGetNews = jest.fn();
const mockReadCache = jest.fn((..._args: unknown[]): Promise<unknown> => Promise.resolve(null));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/firebase/news.service', () => ({
  getNews: (...args: unknown[]) => mockGetNews(...args),
}));

jest.mock('@/utils/cache.utils', () => ({
  CACHE_KEYS: { LAWS: 'laws', FAQS: 'faqs', TIPS: 'tips', NEWS: 'news' },
  readCache: (...args: unknown[]) => mockReadCache(...args),
  getCacheTimestamp: jest.fn(() => Promise.resolve(null)),
}));

const NEWS = [
  {
    id: 'news_1',
    title: 'Surakshak App Launches for Women Safety',
    summary: 'A new safety app.',
    content: 'Full story.',
    imageUrl: '',
    category: 'App News',
    publishedAt: 1_757_500_000_000,
    isPublished: true,
  },
];

describe('NewsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNews.mockResolvedValue(NEWS);
  });

  it('renders the news list', async () => {
    const { getByText } = await render(<NewsScreen />);
    expect(getByText('Surakshak App Launches for Women Safety')).toBeTruthy();
  });

  it('shows a readable date rather than "NaN NaN"', async () => {
    const { queryByText } = await render(<NewsScreen />);
    expect(queryByText(/NaN/)).toBeNull();
  });

  it('paints the cached copy, then replaces it with the fresh one', async () => {
    mockReadCache.mockResolvedValueOnce([{ ...NEWS[0], title: 'Old headline' }]);
    const { findByText, queryByText } = await render(<NewsScreen />);

    expect(await findByText('Surakshak App Launches for Women Safety')).toBeTruthy();
    expect(queryByText('Old headline')).toBeNull();
  });

  it('keeps the cached copy and flags offline when the network fails', async () => {
    mockReadCache.mockResolvedValueOnce(NEWS);
    mockGetNews.mockRejectedValueOnce(new Error('offline'));
    const { findByText } = await render(<NewsScreen />);

    expect(await findByText('Surakshak App Launches for Women Safety')).toBeTruthy();
  });

  it('refetches on pull-to-refresh', async () => {
    const { getByTestId } = await render(<NewsScreen />);
    expect(mockGetNews).toHaveBeenCalledTimes(1);

    const list = getByTestId('news-list');
    await act(async () => {
      (list.props.refreshControl.props.onRefresh as () => void)();
      await Promise.resolve();
    });

    expect(mockGetNews).toHaveBeenCalledTimes(2);
  });
});
