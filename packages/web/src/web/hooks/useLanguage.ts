// ── useLanguage — reads language from UserSettings ────────────────────────────
import { useState, useEffect } from 'react';
import { translations, type Lang, type TranslationKey } from '../lib/i18n';
import { loadSettings, saveSettings, SETTINGS_KEY } from './useSettings';

export type { Lang };

const LANG_KEY = 'tls_lang';

export function getLang(): Lang {
  try {
    return (localStorage.getItem(LANG_KEY) as Lang) ?? 'en';
  } catch {
    return 'en';
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
    window.dispatchEvent(new CustomEvent('tls_lang_changed', { detail: l }));
  } catch { /* ignore */ }
}

/** Translate a key. Falls back to English if Arabic key is missing. */
export function translate(lang: Lang, key: TranslationKey): string {
  return (translations[lang] as Record<string, string>)[key]
    ?? (translations.en as Record<string, string>)[key]
    ?? key;
}

/** React hook — re-renders on language change */
export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(getLang);

  useEffect(() => {
    const handler = (e: Event) => {
      setLangState((e as CustomEvent<Lang>).detail);
    };
    window.addEventListener('tls_lang_changed', handler);
    return () => window.removeEventListener('tls_lang_changed', handler);
  }, []);

  const t = (key: TranslationKey): string => translate(lang, key);
  const isAr = lang === 'ar';

  return { lang, setLang, t, isAr };
}
