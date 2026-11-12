import type { AACButton, Profile } from '../types';
import { PACKS, type Lang, type VocabPack } from '../i18n/packs';
import { CATEGORIES } from '../data/vocab';

/**
 * Switch a profile's vocabulary between languages **in place**: every button
 * keeps its exact position (motor planning); only its words change.
 *
 * Built-in words remember their English original in `key`, so any switch goes
 * from → English → target exactly. Words the family added themselves are left
 * alone unless they match a known word.
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

const enCatName = (id: string) => (id === 'home' ? 'Home' : id === 'more' ? 'More' : CATEGORIES.find((c) => c.id === id)?.name);
const reverse = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

/** Bring a profile back to English (using remembered originals). */
function toEnglish(p: Profile, from: Lang): Profile {
  if (from === 'en') return p;
  const v = PACKS[from].vocab;
  const { toEn } = maps(from);
  const rev = (m?: Record<string, string>) => (m ? reverse(m) : {});
  const phr = rev(v?.phrases), phrCat = rev(v?.phraseCategories), sched = rev(v?.schedule);
  const word = (b: AACButton) => {
    if (b.key) { b.label = b.key; delete b.key; delete b.speak; delete b.forms; return; }
    const en = toEn.get(lower(b.label));
    if (en) { b.label = en; delete b.speak; delete b.forms; }
  };
  for (const b of Object.values(p.boards)) {
    if (b.key) { b.name = b.key; delete b.key; }
    else if (enCatName(b.id) && (b.name === v?.categories[b.id] || b.name === v?.home)) b.name = enCatName(b.id)!;
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
  const word = (b: AACButton) => {
    const folderName = b.link ? v.categories[b.link] : undefined;
    if (folderName) { b.key = b.label; b.label = folderName; return; }
    const hit = toX.get(lower(b.label));
    if (!hit) return;
    b.key = b.label;
    b.label = hit[0];
    if (hit[1] !== hit[0]) b.speak = hit[1]; else delete b.speak;
    delete b.forms; // forms are language-specific
  };
  for (const b of Object.values(p.boards)) {
    const n = b.id === 'home' && b.name === 'Home' ? v.home : v.categories[b.id] ?? toX.get(lower(b.name))?.[0];
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

export function translateProfile(input: Profile, to: Lang): Profile {
  const from: Lang = (input.settings.language as Lang) ?? 'en';
  if (from === to) return input;
  const p = fromEnglish(toEnglish(structuredClone(input), from), to);
  p.settings = { ...p.settings, language: to, lang: PACKS[to].voice, voiceURI: undefined, voiceIndex: undefined, voiceName: undefined };
  p.lexicon = {};
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

/** The same built-in word in a second language (bilingual button labels). */
export function secondWord(b: AACButton, comm: Lang, second: Lang): string | undefined {
  if (!second || second === comm) return undefined;
  const en = b.key ?? (comm === 'en' ? b.label : undefined);
  if (!en) return undefined;
  const out = b.link
    ? (second === 'en' ? en : PACKS[second].vocab?.categories[b.link] ?? wordIn(en, second))
    : wordIn(en, second);
  return out && out.toLowerCase() !== b.label.toLowerCase() ? out : undefined;
}
