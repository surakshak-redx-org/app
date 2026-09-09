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

/**
 * Lists published laws in display order.
 * @phase Phase 6 — Information Hub
 */
export function getLaws(): Promise<Law[]> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}

/**
 * Reads a single law by id.
 * @phase Phase 6 — Information Hub
 */
export function getLawById(_lawId: string): Promise<Law | null> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}

/**
 * Lists published safety tips in display order.
 * @phase Phase 6 — Information Hub
 */
export function getSafetyTips(): Promise<SafetyTip[]> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}

/**
 * Lists published FAQs in display order.
 * @phase Phase 6 — Information Hub
 */
export function getFaqs(): Promise<Faq[]> {
  return Promise.reject(new Error('Not implemented — Phase 6'));
}
