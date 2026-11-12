import { ES_UI } from './es';

export type Lang = 'en' | 'es';

export const LANGUAGES: { id: Lang; name: string; voice: string }[] = [
  { id: 'en', name: 'English', voice: 'en-US' },
  { id: 'es', name: 'Español', voice: 'es-US' },
];

let current: Lang = 'en';
export const setLang = (l: Lang) => { current = l; };
export const getLang = () => current;

const DICTS: Record<Lang, Record<string, string>> = { en: {}, es: ES_UI };

/**
 * Translate a UI string. Keys are the English text, so anything without a
 * translation simply shows in English. `{name}` placeholders are filled from vars.
 */
export function t(s: string, vars?: Record<string, string | number | undefined>): string {
  const out = (current === 'en' ? s : DICTS[current][s] ?? s);
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : out;
}
