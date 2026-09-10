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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

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
 * Cache-first list read: returns cached content immediately and refreshes in
 * the background; on a cold cache it awaits the network. See `cache.utils`.
 */
async function getCachedList<T>(collectionName: string, cacheKey: string): Promise<T[]> {
  const cached = await readCache<T[]>(cacheKey);
  if (cached) {
    void fetchPublished<T>(collectionName, cacheKey).catch((error: unknown) =>
      console.warn(`${cacheKey} background refresh failed:`, error),
    );
    return cached;
  }
  return fetchPublished<T>(collectionName, cacheKey);
}

/**
 * Lists published laws in display order (cache-first).
 * @phase Phase 6 — Information Hub
 */
export async function getLaws(): Promise<Law[]> {
  try {
    return await getCachedList<Law>(LAWS_COLLECTION, CACHE_KEYS.LAWS);
  } catch (error) {
    console.error('getLaws failed:', error);
    throw error;
  }
}

/**
 * Reads a single law by id — from the cached list when possible, else Firestore.
 * @phase Phase 6 — Information Hub
 */
export async function getLawById(lawId: string): Promise<Law | null> {
  try {
    const cached = await readCache<Law[]>(CACHE_KEYS.LAWS);
    const hit = cached?.find((law) => law.id === lawId);
    if (hit) return hit;

    const snapshot = await getDoc(doc(firestore, LAWS_COLLECTION, lawId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...(snapshot.data() as Omit<Law, 'id'>) };
  } catch (error) {
    console.error('getLawById failed:', error);
    throw error;
  }
}

/**
 * Lists published safety tips in display order (cache-first).
 * @phase Phase 6 — Information Hub
 */
export async function getSafetyTips(): Promise<SafetyTip[]> {
  try {
    return await getCachedList<SafetyTip>(SAFETY_TIPS_COLLECTION, CACHE_KEYS.TIPS);
  } catch (error) {
    console.error('getSafetyTips failed:', error);
    throw error;
  }
}

/**
 * Lists published FAQs in display order (cache-first).
 * @phase Phase 6 — Information Hub
 */
export async function getFaqs(): Promise<Faq[]> {
  try {
    return await getCachedList<Faq>(FAQS_COLLECTION, CACHE_KEYS.FAQS);
  } catch (error) {
    console.error('getFaqs failed:', error);
    throw error;
  }
}

/** Distinct law categories, alphabetically sorted. */
export async function getLawCategories(): Promise<string[]> {
  try {
    const laws = await getLaws();
    return uniqueSorted(laws.map((law) => law.category));
  } catch (error) {
    console.error('getLawCategories failed:', error);
    throw error;
  }
}

/** Distinct safety-tip categories, alphabetically sorted. */
export async function getSafetyTipCategories(): Promise<string[]> {
  try {
    const tips = await getSafetyTips();
    return uniqueSorted(tips.map((tip) => tip.category));
  } catch (error) {
    console.error('getSafetyTipCategories failed:', error);
    throw error;
  }
}

/** Distinct FAQ categories, alphabetically sorted. */
export async function getFaqCategories(): Promise<string[]> {
  try {
    const faqs = await getFaqs();
    return uniqueSorted(faqs.map((faq) => faq.category));
  } catch (error) {
    console.error('getFaqCategories failed:', error);
    throw error;
  }
}
