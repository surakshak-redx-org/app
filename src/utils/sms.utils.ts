import type { Language } from '@/types/user.types';

/**
 * SMS goes out over the device SIM with no delivery guarantee and a hard
 * 160-character-per-segment budget, so these stay short and lead with the
 * location link — the one piece a recipient acts on first.
 *
 * TODO: Phase 8 — Multilingual. `hi` and `mr` intentionally fall through to
 * English until translations are reviewed by a native speaker; a wrong
 * translation on an emergency message is worse than a correct English one.
 */
function resolveLanguage(language: Language): 'en' {
  if (language !== 'en') {
    // TODO: Phase 8 — translation
  }
  return 'en';
}

export function buildSOSMessage(name: string, locationUrl: string, language: Language): string {
  resolveLanguage(language);
  return `EMERGENCY: ${name} needs help right now. Live location: ${locationUrl} — Sent by Surakshak.`;
}

export function buildLowBatteryMessage(
  name: string,
  locationUrl: string,
  language: Language,
): string {
  resolveLanguage(language);
  return `${name}'s phone battery is critically low. Last known location: ${locationUrl} — Sent by Surakshak.`;
}

export function buildSafeJourneyMessage(
  name: string,
  destination: string,
  etaTime: string,
  language: Language,
): string {
  resolveLanguage(language);
  return `${name} is travelling to ${destination} and should arrive by ${etaTime}. You will be alerted if they do not check in. — Sent by Surakshak.`;
}
