// ── useLanguage — always English ──────────────────────────────────────────────
import { translations, type TranslationKey } from '../lib/i18n';

export type Lang = 'en';

export function getLang(): Lang { return 'en'; }
export function setLang(_l: string) { /* no-op */ }

export function translate(_lang: Lang, key: TranslationKey): string {
  return (translations.en as Record<string, string>)[key] ?? key;
}

export function useLanguage() {
  const t = (key: TranslationKey): string => translate('en', key);
  return { lang: 'en' as Lang, setLang, t, isAr: false };
}
