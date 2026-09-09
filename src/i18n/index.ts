import { getLocales } from 'expo-localization';
import i18n, { changeLanguage as i18nChangeLanguage, use as i18nUse } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en.json';
import hi from '@/i18n/locales/hi.json';
import mr from '@/i18n/locales/mr.json';
import type { Language } from '@/types/user.types';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'hi', 'mr'] as const;

export const FALLBACK_LANGUAGE: Language = 'en';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
} as const;

function isSupportedLanguage(code: string): code is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Device language when we support it, English otherwise. */
export function detectDeviceLanguage(): Language {
  const deviceCode = getLocales()[0]?.languageCode;

  if (deviceCode !== undefined && deviceCode !== null && isSupportedLanguage(deviceCode)) {
    return deviceCode;
  }

  return FALLBACK_LANGUAGE;
}

void i18nUse(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  // hi/mr ship as empty shells until Phase 8. Without this, i18next would treat
  // "" as a valid translation and render a blank UI instead of falling back.
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  // React already guards against XSS and there is no Suspense boundary above
  // the root layout to catch a lazily-loaded catalogue.
  react: { useSuspense: false },
});

export async function changeLanguage(language: Language): Promise<void> {
  try {
    await i18nChangeLanguage(language);
  } catch (error) {
    console.error('changeLanguage failed:', error);
    throw error;
  }
}

export default i18n;
