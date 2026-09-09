interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  publishedAt: number;
  isPublished: boolean;
}

export type { NewsArticle };

/**
 * Lists published news articles, newest first.
 * @phase Phase 6 — Information Hub
 */
export function getNews(_limit: number): Promise<NewsArticle[]> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}

/**
 * Reads a single news article.
 * @phase Phase 6 — Information Hub
 */
export function getNewsById(_newsId: string): Promise<NewsArticle | null> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}
