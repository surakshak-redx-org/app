import { act, render } from '@testing-library/react-native';
import React from 'react';

import NewsScreen from '@app/news';

const mockGetNews = jest.fn();
const mockGetNewsCategories = jest.fn();
const mockClearCache = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/firebase/news.service', () => ({
  getNews: (...args: unknown[]) => mockGetNews(...args),
  getNewsCategories: (...args: unknown[]) => mockGetNewsCategories(...args),
}));

jest.mock('@/utils/cache.utils', () => ({
  CACHE_KEYS: { LAWS: 'laws', FAQS: 'faqs', TIPS: 'tips', NEWS: 'news' },
  clearCache: (...args: unknown[]) => mockClearCache(...args),
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
    mockGetNewsCategories.mockResolvedValue(['App News']);
  });

  it('renders the news list', async () => {
    const { getByText } = await render(<NewsScreen />);
    expect(getByText('Surakshak App Launches for Women Safety')).toBeTruthy();
  });

  it('clears the cache and refetches on pull-to-refresh', async () => {
    const { getByTestId } = await render(<NewsScreen />);
    expect(mockGetNews).toHaveBeenCalledTimes(1);

    const list = getByTestId('news-list');
    await act(async () => {
      (list.props.refreshControl.props.onRefresh as () => void)();
      await Promise.resolve();
    });

    expect(mockClearCache).toHaveBeenCalledWith('news');
    expect(mockGetNews).toHaveBeenCalledTimes(2);
  });
});
