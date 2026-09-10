import { render } from '@testing-library/react-native';
import React from 'react';

import NewsDetailScreen from '@app/news/[id]';

const mockGetNewsById = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'news_1' }),
}));

jest.mock('@/services/firebase/news.service', () => ({
  getNewsById: (...args: unknown[]) => mockGetNewsById(...args),
}));

const ARTICLE = {
  id: 'news_1',
  title: 'Surakshak App Launches for Women Safety in India',
  summary: 'A new mobile app.',
  content: 'Surakshak is a new women safety application built by the REDX Club.',
  imageUrl: '',
  category: 'App News',
  publishedAt: 1_757_500_000_000,
  isPublished: true,
};

describe('NewsDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNewsById.mockResolvedValue(ARTICLE);
  });

  it('renders the article title and body', async () => {
    const { getByText } = await render(<NewsDetailScreen />);
    expect(getByText(ARTICLE.title)).toBeTruthy();
    expect(getByText(ARTICLE.content)).toBeTruthy();
  });

  it('shows an error state when the article is missing', async () => {
    mockGetNewsById.mockResolvedValue(null);
    const { getByText } = await render(<NewsDetailScreen />);
    expect(getByText("Couldn't load content. Pull to refresh or try later.")).toBeTruthy();
  });
});
