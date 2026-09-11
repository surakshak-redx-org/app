import type { Language } from '@/types/user.types';

export interface LanguageOption {
  code: Language;
  /** Flag emoji shown beside the name. */
  flag: string;
  /** Endonym — displayed as-is in every locale, never translated. */
  native: string;
  /** English name — helps a user who can't read the native script identify it. */
  englishName: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en', flag: '🇬🇧', native: 'English', englishName: 'English' },
  { code: 'hi', flag: '🇮🇳', native: 'हिन्दी', englishName: 'Hindi' },
  { code: 'mr', flag: '🇮🇳', native: 'मराठी', englishName: 'Marathi' },
];

/** The endonym for a language code, e.g. `'hi'` → `'हिन्दी'`. */
export function languageLabel(code: Language): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === code)?.native ?? code;
}
