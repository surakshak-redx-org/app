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
import { CACHE_KEYS, readCache, writeCache } from '@/utils/cache.utils';
import { toMillis } from '@/utils/date.utils';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  /** Epoch millis — converted from the Firestore Timestamp the admin writes. */
  publishedAt: number;
  isPublished: boolean;
}

export type { NewsArticle };

const NEWS_COLLECTION = 'news';

/**
 * The admin writes `publishedAt` as a Firestore Timestamp; the app treated it
 * as a number, and `new Date(Timestamp)` is an Invalid Date — "NaN NaN" on
 * every card (BUG-001). Normalise to millis before it reaches the UI or cache.
 */
function toArticle(id: string, data: Record<string, unknown>): NewsArticle {
  return {
    ...(data as Omit<NewsArticle, 'id' | 'publishedAt'>),
    id,
    publishedAt: toMillis(data.publishedAt) ?? 0,
  };
}

async function fetchNews(limitCount: number): Promise<NewsArticle[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, NEWS_COLLECTION),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(limitCount),
    ),
  );
  const items = snapshot.docs.map((docSnap) =>
    toArticle(docSnap.id, docSnap.data() as Record<string, unknown>),
  );
  await writeCache(CACHE_KEYS.NEWS, items);
  return items;
}

/**
 * Fetches published news, newest first, from Firestore and refreshes the
 * offline cache (network; `useInfoContent` handles the cached fallback).
 * @phase Phase 6 — Information Hub
 */
export async function getNews(limitCount: number): Promise<NewsArticle[]> {
  try {
    return await fetchNews(limitCount);
  } catch (error) {
    console.error('getNews failed:', error);
    throw error;
  }
}

/**
 * Reads a single news article — from Firestore, falling back to the cached
 * list when offline.
 * @phase Phase 6 — Information Hub
 */
export async function getNewsById(newsId: string): Promise<NewsArticle | null> {
  try {
    const snapshot = await getDoc(doc(firestore, NEWS_COLLECTION, newsId));
    if (!snapshot.exists()) return null;
    return toArticle(snapshot.id, snapshot.data());
  } catch (error) {
    const cached = await readCache<NewsArticle[]>(CACHE_KEYS.NEWS, { allowStale: true });
    const hit = cached?.find((article) => article.id === newsId);
    if (hit) return hit;
    console.error('getNewsById failed:', error);
    throw error;
  }
}
