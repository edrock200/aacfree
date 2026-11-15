import type { AACButton, Board, Profile } from '../types';
import { PACKS, type Lang, type VocabPack } from '../i18n/packs';
import { CATEGORIES, HOME_LAYOUTS, MORE_BOARD, QUICK_BAR, parseSpec } from '../data/vocab';

/**
 * Switch a profile's vocabulary between languages **in place**: every button
 * keeps its exact position (motor planning); only its words change.
 *
 * Built-in words remember their English original in `key`, so any switch goes
 * from → English → target exactly. A built-in button the family relabelled (or
 * gave its own spoken text) is the family's own word from then on: it loses
 * its `key` and keeps its label, spoken text and forms in every language.
 * Words the family added themselves are left alone unless they are exactly a
 * built-in word (for example one added from the symbol library).
 */

type Pair = [string, string]; // [label, spoken]
const lower = (s: string) => s.toLowerCase();
const pair = (v: string | [string, string]): Pair => (Array.isArray(v) ? v : [v, v]);

interface Maps { toX: Map<string, Pair>; toEn: Map<string, string> }
const cache = new Map<Lang, Maps>();
function maps(l: Lang): Maps {
  let m = cache.get(l);
  if (m) return m;
  const toX = new Map<string, Pair>();
  const toEn = new Map<string, string>();
  for (const [en, v] of Object.entries(PACKS[l].vocab?.labels ?? {})) {
    const [label, speak] = pair(v);
    // Exact lower-case entries win over capitalised ones ("more" → word, not the folder name).
    if (!toX.has(lower(en)) || en === lower(en)) toX.set(lower(en), [label, speak]);
    if (!toEn.has(lower(label))) toEn.set(lower(label), en);
  }
  m = { toX, toEn };
  cache.set(l, m);
  return m;
}

/** Exact labels of every built-in English word, and their spoken text where it differs ("how much?" → "how much is it?"). */
let builtIns: { labels: Set<string>; speak: Map<string, string> } | null = null;
function english() {
  if (builtIns) return builtIns;
  const labels = new Set<string>(['Keyboard', 'Phrases', 'Tools', 'Word forms', 'Home', 'More']);
  const speak = new Map<string, string>();
  const add = (spec: string) => {
    if (!spec || spec.startsWith('>') || spec.startsWith('!')) return;
    const p = parseSpec(spec);
    labels.add(p.label);
    if (p.speak && p.speak !== p.label && !speak.has(p.label)) speak.set(p.label, p.speak);
  };
  CATEGORIES.forEach((c) => { labels.add(c.name); c.items.forEach(add); });
  Object.values(HOME_LAYOUTS).forEach((l) => l.cells.forEach(add));
  QUICK_BAR.forEach(add);
  MORE_BOARD.forEach(add);
  builtIns = { labels, speak };
  return builtIns;
}

const enCatName = (id: string) => (id === 'home' ? 'Home' : id === 'more' ? 'More' : CATEGORIES.find((c) => c.id === id)?.name);
const reverse = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

/** What `fromEnglish` makes of a built-in English word in language `l`: [label, spoken]. */
function packWord(en: string, link: string | undefined, l: Lang): Pair | undefined {
  const v = PACKS[l].vocab;
  const folderName = link ? v?.categories[link] : undefined;
  if (folderName) return [folderName, folderName];
  return maps(l).toX.get(lower(en));
}

/** True if the button still says exactly what the language pack gave it (label and spoken text). */
function isPackWord(b: AACButton, w: Pair | undefined): boolean {
  if (!w) return false;
  return b.label === w[0] && (b.speak ?? b.label) === (w[1] ?? w[0]);
}

/** Name the language pack gives a built-in board (mirrors `fromEnglish`). */
function packBoardName(b: Board, en: string, l: Lang): string | undefined {
  const v = PACKS[l].vocab;
  if (!v) return undefined;
  return b.id === 'home' && en === 'Home' ? v.home : v.categories[b.id] ?? maps(l).toX.get(lower(en))?.[0];
}

/** Bring a profile back to English (using remembered originals). */
function toEnglish(p: Profile, from: Lang): Profile {
  if (from === 'en') return p;
  const v = PACKS[from].vocab;
  const { toEn } = maps(from);
  const { speak: enSpeak } = english();
  const rev = (m?: Record<string, string>) => (m ? reverse(m) : {});
  const phr = rev(v?.phrases), phrCat = rev(v?.phraseCategories), sched = rev(v?.schedule);
  const toBuiltIn = (b: AACButton, en: string) => {
    b.label = en;
    const s = enSpeak.get(en);
    if (s) b.speak = s; else delete b.speak;
    delete b.forms; // forms are language-specific
    delete b.key;
  };
  const word = (b: AACButton) => {
    if (b.key) {
      // A built-in word the family has not changed goes back to its English original.
      if (isPackWord(b, packWord(b.key, b.link, from))) toBuiltIn(b, b.key);
      else delete b.key; // relabelled by the family: it is their word now
      return;
    }
    // Unmarked words (e.g. added from the symbol library) only when they are exactly a built-in word.
    const en = toEn.get(lower(b.label));
    if (en && !b.forms?.length && isPackWord(b, packWord(en, b.link, from))) toBuiltIn(b, en);
  };
  for (const b of Object.values(p.boards)) {
    if (b.key) {
      if (b.name === packBoardName(b, b.key, from)) b.name = b.key;
      delete b.key;
    } else if (enCatName(b.id) && (b.name === v?.categories[b.id] || b.name === v?.home)) b.name = enCatName(b.id)!;
    for (const c of b.cells) if (c) word(c);
  }
  p.quickBar.forEach(word);
  p.phrases = p.phrases.map((ph) => ({ ...ph, text: phr[ph.text] ?? ph.text, category: phrCat[ph.category] ?? ph.category }));
  p.phraseCategories = p.phraseCategories.map((c) => phrCat[c] ?? c);
  p.schedules = p.schedules.map((s) => ({
    ...s, name: sched[s.name] ?? s.name,
    steps: s.steps.map((st) => ({ ...st, label: sched[st.label] ?? toEn.get(lower(st.label)) ?? st.label })),
  }));
  return p;
}

/** Translate an English profile into `to`. */
function fromEnglish(p: Profile, to: Lang): Profile {
  if (to === 'en') return p;
  const v = PACKS[to].vocab as VocabPack;
  const { toX } = maps(to);
  const { labels: enLabels, speak: enSpeak } = english();
  const word = (b: AACButton) => {
    delete b.key; // English has no keys; a stale one must not survive
    const folderName = b.link ? v.categories[b.link] : undefined;
    if (folderName) {
      // A built-in folder keeps its translated name unless the family renamed it.
      if (lower(b.label) === lower(enCatName(b.link!) ?? '')) { b.key = b.label; b.label = folderName; }
      return;
    }
    // Only built-in words (exact spelling: a button named "Will" or "Cookie" is a name, not a word)…
    if (!enLabels.has(b.label)) return;
    // …that still say their built-in spoken text.
    if (b.speak && b.speak !== b.label && b.speak !== enSpeak.get(b.label)) return;
    const hit = toX.get(lower(b.label));
    if (!hit) return;
    b.key = b.label;
    b.label = hit[0];
    if (hit[1] !== hit[0]) b.speak = hit[1]; else delete b.speak;
    delete b.forms; // forms are language-specific
  };
  for (const b of Object.values(p.boards)) {
    delete b.key;
    // Built-in boards keep their translated name unless the family renamed them.
    const builtIn = enCatName(b.id);
    const n = builtIn
      ? (b.name === builtIn ? (b.id === 'home' ? v.home : v.categories[b.id]) : undefined)
      : enLabels.has(b.name) ? toX.get(lower(b.name))?.[0] : undefined;
    if (n && n !== b.name) { b.key = b.name; b.name = n; }
    for (const c of b.cells) if (c) word(c);
  }
  p.quickBar.forEach(word);
  p.phrases = p.phrases.map((ph) => ({ ...ph, text: v.phrases[ph.text] ?? ph.text, category: v.phraseCategories[ph.category] ?? ph.category }));
  p.phraseCategories = p.phraseCategories.map((c) => v.phraseCategories[c] ?? c);
  p.schedules = p.schedules.map((s) => ({
    ...s, name: v.schedule[s.name] ?? s.name,
    steps: s.steps.map((st) => ({ ...st, label: v.schedule[st.label] ?? toX.get(lower(st.label))?.[0] ?? st.label })),
  }));
  return p;
}

/** The built-in "About me" card text in a language. */
export function aboutMeText(lang: Lang, name: string): string {
  if (lang !== 'en' && PACKS[lang].vocab) return PACKS[lang].vocab!.aboutMe(name);
  return `Hi! My name is ${name || '…'}. I am autistic and I use this app to communicate. Please be patient and give me extra time to answer. I understand more than I can say.`;
}

/** If `text` is the untouched built-in About me text of `lang`, the name in it ('' for none); otherwise null. */
function aboutMeName(text: string, lang: Lang): string | null {
  const MARK = '\u0000';
  const [pre, post] = aboutMeText(lang, MARK).split(MARK);
  if (post === undefined || text.length < pre.length + post.length || !text.startsWith(pre) || !text.endsWith(post)) return null;
  const name = text.slice(pre.length, text.length - post.length);
  return name === '…' ? '' : name;
}

export function translateProfile(input: Profile, to: Lang): Profile {
  const from: Lang = (input.settings.language as Lang) ?? 'en';
  if (from === to) return input;
  const p = fromEnglish(toEnglish(structuredClone(input), from), to);
  p.settings = { ...p.settings, language: to, lang: PACKS[to].voice, voiceURI: undefined, voiceIndex: undefined, voiceName: undefined };
  p.lexicon = {};
  // The About me card follows the language too, unless the family wrote their own.
  const name = p.aboutMe ? aboutMeName(p.aboutMe.text, from) : null;
  if (name !== null) p.aboutMe = { ...p.aboutMe, text: aboutMeText(to, name) };
  return p;
}

/** A built-in (English) word in another language, e.g. for bilingual button labels. */
export function wordIn(en: string, lang: Lang): string | undefined {
  if (lang === 'en') return en;
  return maps(lang).toX.get(lower(en))?.[0];
}

/** Label of a built-in library symbol in the given language. */
export function localLabel(en: string, lang: Lang): string {
  return wordIn(en, lang) ?? en;
}
export function localCategory(id: string, name: string, lang: Lang): string {
  if (lang === 'en') return name;
  const v = PACKS[lang].vocab;
  if (id === 'lib-core') return v?.core ?? name;
  if (id === 'lib-extra') return v?.extra ?? name;
  return v?.categories[id.replace(/^lib-/, '')] ?? name;
}

/**
 * English originals of the built-in words whose label in `lang` matches a
 * search (accent- and case-insensitive): exact matches first, then word
 * starts, then (for 3+ letters) anywhere. Lets symbol search use the bundled
 * English index in every language.
 */
export function englishMatches(query: string, lang: Lang, limit = 40): { en: string; label: string }[] {
  const q = fold(query.trim());
  if (!q || lang === 'en') return [];
  const passes: { en: string; label: string }[][] = [[], [], []];
  for (const [en, v] of Object.entries(PACKS[lang].vocab?.labels ?? {})) {
    const label = pair(v)[0];
    const l = fold(label);
    const pass = l === q ? 0 : l.startsWith(q) || l.split(/[\s'’-]+/).some((w) => w.startsWith(q)) ? 1 : q.length >= 3 && l.includes(q) ? 2 : -1;
    if (pass >= 0) passes[pass].push({ en: lower(en), label });
  }
  const seen = new Set<string>();
  return passes.flat().filter((x) => (seen.has(x.en) ? false : (seen.add(x.en), true))).slice(0, limit);
}

/** Lower-case and drop accents: "Café" → "cafe". */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** The same built-in word in a second language (bilingual button labels). */
export function secondWord(b: AACButton, comm: Lang, second: Lang): string | undefined {
  if (!second || second === comm) return undefined;
  const en = b.key ?? (comm === 'en' && (b.link || english().labels.has(b.label)) ? b.label : undefined);
  if (!en) return undefined;
  const out = b.link
    ? (second === 'en' ? en : PACKS[second].vocab?.categories[b.link] ?? wordIn(en, second))
    : wordIn(en, second);
  return out && out.toLowerCase() !== b.label.toLowerCase() ? out : undefined;
}

/** English name of a phrase group in any language ("Necesidades" → "Needs"); custom groups keep their own name. */
export function phraseGroupKey(name: string): string {
  for (const id of Object.keys(PACKS) as Lang[]) {
    const m = PACKS[id].vocab?.phraseCategories;
    if (!m) continue;
    for (const [en, local] of Object.entries(m)) if (local === name) return en;
  }
  return name;
}
