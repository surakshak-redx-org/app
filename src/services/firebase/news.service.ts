import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';

import { firestore } from '@/config/firebase';
import { APP_CONFIG } from '@/constants/config';
import { CACHE_KEYS, readCache, writeCache } from '@/utils/cache.utils';

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

const NEWS_COLLECTION = 'news';

async function fetchNews(limitCount: number): Promise<NewsArticle[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, NEWS_COLLECTION),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(limitCount),
    ),
  );
  const items = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<NewsArticle, 'id'>),
  }));
  await writeCache(CACHE_KEYS.NEWS, items);
  return items;
}

/**
 * Lists published news articles, newest first (cache-first): returns cached
 * items immediately and refreshes in the background; awaits the network on a
 * cold cache.
 * @phase Phase 6 — Information Hub
 */
export async function getNews(limitCount: number): Promise<NewsArticle[]> {
  try {
    const cached = await readCache<NewsArticle[]>(CACHE_KEYS.NEWS);
    if (cached) {
      void fetchNews(limitCount).catch((error: unknown) =>
        console.warn('news background refresh failed:', error),
      );
      return cached;
    }
    return await fetchNews(limitCount);
  } catch (error) {
    console.error('getNews failed:', error);
    throw error;
  }
}

/**
 * Reads a single news article — from the cached list when possible, else Firestore.
 * @phase Phase 6 — Information Hub
 */
export async function getNewsById(newsId: string): Promise<NewsArticle | null> {
  try {
    const cached = await readCache<NewsArticle[]>(CACHE_KEYS.NEWS);
    const hit = cached?.find((article) => article.id === newsId);
    if (hit) return hit;

    const snapshot = await getDoc(doc(firestore, NEWS_COLLECTION, newsId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...(snapshot.data() as Omit<NewsArticle, 'id'>) };
  } catch (error) {
    console.error('getNewsById failed:', error);
    throw error;
  }
}

/** Distinct news categories, alphabetically sorted. */
export async function getNewsCategories(): Promise<string[]> {
  try {
    const news = await getNews(APP_CONFIG.NEWS_FEED_LIMIT);
    return [...new Set(news.map((article) => article.category))].sort();
  } catch (error) {
    console.error('getNewsCategories failed:', error);
    throw error;
  }
}
