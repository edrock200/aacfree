import { PACKS, LANGUAGES, isLang, type Lang } from './packs';

export type { Lang };
export { LANGUAGES, PACKS, isLang };

/**
 * Two languages can be active at once:
 *  - the **app language** (menus, settings, help) — what the grown-ups read
 *  - the **communication language** (board words, grammar, keyboard, voice,
 *    anything spoken) — what the AAC user talks in
 * They are usually the same, but a parent can use English menus while their
 * child talks in Spanish, for example.
 */
let ui: Lang = 'en';
let comm: Lang = 'en';

/** Set both languages (onboarding). */
export const setLang = (l: Lang) => { ui = l; comm = l; };
export const setLangs = (appLang: Lang, commLang: Lang) => { ui = appLang; comm = commLang; };
/** Communication language (vocabulary, grammar, keyboard, speech). */
export const getLang = () => comm;
/** App (interface) language. */
export const getUiLang = () => ui;
export const pack = (l: Lang = comm) => PACKS[l] ?? PACKS.en;

function translate(l: Lang, s: string, vars?: Record<string, string | number | undefined>) {
  const out = l === 'en' ? s : PACKS[l]?.ui[s] ?? s;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : out;
}

/**
 * Translate an interface string into the app language. Keys are the English
 * text, so anything without a translation simply shows in English.
 */
export const t = (s: string, vars?: Record<string, string | number | undefined>) => translate(ui, s, vars);

/** Translate something the app will **say aloud** into the communication language. */
export const ts = (s: string, vars?: Record<string, string | number | undefined>) => translate(comm, s, vars);

/** Translate into a specific language (e.g. a confirmation shown in the language being switched to). */
export const tIn = (l: Lang, s: string, vars?: Record<string, string | number | undefined>) => translate(l, s, vars);
