import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';

import { firestore } from '@/config/firebase';
import { CACHE_KEYS, readCache, writeCache } from '@/utils/cache.utils';

interface Law {
  id: string;
  title: string;
  shortDescription: string;
  fullContent: string;
  category: string;
  tags: string[];
  order: number;
  isPublished: boolean;
}

interface SafetyTip {
  id: string;
  title: string;
  content: string;
  category: string;
  order: number;
  isPublished: boolean;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
}

export type { Faq, Law, SafetyTip };

const LAWS_COLLECTION = 'laws';
const FAQS_COLLECTION = 'faqs';
const SAFETY_TIPS_COLLECTION = 'safetyTips';

async function fetchPublished<T>(collectionName: string, cacheKey: string): Promise<T[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, collectionName),
      where('isPublished', '==', true),
      orderBy('order', 'asc'),
    ),
  );
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<T, 'id'>) }) as T);
  await writeCache(cacheKey, items);
  return items;
}

/**
 * Fetches published laws in display order from Firestore and refreshes the
 * offline cache. Always goes to the network: the old cache-first read showed
 * the previous copy and only refreshed the file in the background, so admin
 * edits never reached an open screen (BUG-002). `useInfoContent` paints the
 * cached copy first and falls back to it when this rejects.
 * @phase Phase 6 — Information Hub
 */
export async function getLaws(): Promise<Law[]> {
  try {
    return await fetchPublished<Law>(LAWS_COLLECTION, CACHE_KEYS.LAWS);
  } catch (error) {
    console.error('getLaws failed:', error);
    throw error;
  }
}

/**
 * Reads a single law by id — from Firestore, falling back to the cached list
 * when offline so a law opened once stays readable.
 * @phase Phase 6 — Information Hub
 */
export async function getLawById(lawId: string): Promise<Law | null> {
  try {
    const snapshot = await getDoc(doc(firestore, LAWS_COLLECTION, lawId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...(snapshot.data() as Omit<Law, 'id'>) };
  } catch (error) {
    const cached = await readCache<Law[]>(CACHE_KEYS.LAWS, { allowStale: true });
    const hit = cached?.find((law) => law.id === lawId);
    if (hit) return hit;
    console.error('getLawById failed:', error);
    throw error;
  }
}

/**
 * Fetches published safety tips in display order (network; see `getLaws`).
 * @phase Phase 6 — Information Hub
 */
export async function getSafetyTips(): Promise<SafetyTip[]> {
  try {
    return await fetchPublished<SafetyTip>(SAFETY_TIPS_COLLECTION, CACHE_KEYS.TIPS);
  } catch (error) {
    console.error('getSafetyTips failed:', error);
    throw error;
  }
}

/**
 * Fetches published FAQs in display order (network; see `getLaws`).
 * @phase Phase 6 — Information Hub
 */
export async function getFaqs(): Promise<Faq[]> {
  try {
    return await fetchPublished<Faq>(FAQS_COLLECTION, CACHE_KEYS.FAQS);
  } catch (error) {
    console.error('getFaqs failed:', error);
    throw error;
  }
}
