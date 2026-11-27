/**
 * Arabic-first, English second. Strings live next to the component that shows them: `t({ar, en})`.
 * The language sets <html lang dir>, so layout uses logical CSS and mirrors by itself.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { L, Lang } from './contracts';

const KEY = 'silsila-lang';

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'ar' || q === 'en') return q;
    const saved = localStorage.getItem(KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* private mode */ }
  return 'ar';
}

export interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang(l: Lang): void;
  t(text: L): string;
  /** localised digits: Arabic-Indic in Arabic */
  n(value: number, maximumFractionDigits?: number): string;
}

export const formatNumber = (lang: Lang, value: number, maximumFractionDigits = 0) =>
  value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits });

const Context = createContext<I18n | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const value = useMemo<I18n>(() => ({
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    setLang(l) {
      setLangState(l);
      try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
    },
    t: (text) => text[lang],
    n: (v, d) => formatNumber(lang, v, d),
  }), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = value.dir;
    document.title = lang === 'ar' ? 'سِلسِلة · خلّي التفكير يبيّن' : 'SILSILA · Make Thinking Visible';
  }, [lang, value.dir]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Context);
  if (!v) throw new Error('LangProvider missing');
  return v;
}
