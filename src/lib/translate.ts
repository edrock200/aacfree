import type { Profile } from '../types';
import type { Lang } from '../i18n';
import { ES_CATEGORY_NAMES, ES_LABELS, ES_PHRASE_CATEGORIES, ES_PHRASES, ES_SCHEDULE } from '../data/i18n/es-vocab';
import { CATEGORIES } from '../data/vocab';

/**
 * Switch a profile's vocabulary between languages **in place**: every button
 * keeps its exact position (motor planning), only its words change. Words the
 * family added themselves are left alone unless they match a known word.
 */

type Pair = [string, string]; // [label, spoken]
const lower = (s: string) => s.toLowerCase();

function maps(): { toEs: Map<string, Pair>; toEn: Map<string, Pair> } {
  const toEs = new Map<string, Pair>();
  const toEn = new Map<string, Pair>();
  for (const [en, v] of Object.entries(ES_LABELS)) {
    const [label, speak] = Array.isArray(v) ? v : [v, v];
    toEs.set(lower(en), [label, speak]);
    if (!toEn.has(lower(label))) toEn.set(lower(label), [en, en]);
  }
  return { toEs, toEn };
}

const reverse = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

export function translateProfile(p: Profile, to: Lang): Profile {
  const from: Lang = p.settings.language ?? 'en';
  if (from === to) return p;
  const { toEs, toEn } = maps();
  const words = to === 'es' ? toEs : toEn;
  const catNames = to === 'es' ? ES_CATEGORY_NAMES : reverse(ES_CATEGORY_NAMES);
  const phrases = to === 'es' ? ES_PHRASES : reverse(ES_PHRASES);
  const phraseCats = to === 'es' ? ES_PHRASE_CATEGORIES : reverse(ES_PHRASE_CATEGORIES);
  const sched = to === 'es' ? ES_SCHEDULE : reverse(ES_SCHEDULE);
  const enName = (id: string) => (id === 'home' ? 'Home' : id === 'more' ? 'More' : CATEGORIES.find((c) => c.id === id)?.name);
  const nameById = (id: string, name: string) => {
    if (to === 'es') return (id === 'home' && name === 'Home' ? 'Inicio' : undefined) ?? ES_CATEGORY_NAMES[id] ?? catNames[name] ?? words.get(lower(name))?.[0] ?? name;
    // Back to English: built-in boards by id; others only if the name is a known Spanish one.
    const known = enName(id);
    if (known && name === (ES_CATEGORY_NAMES[id] ?? (id === 'home' ? 'Inicio' : undefined))) return known;
    return words.get(lower(name))?.[0] ?? name;
  };

  const out = structuredClone(p);
  for (const b of Object.values(out.boards)) {
    b.name = nameById(b.id, b.name);
    for (const c of b.cells) {
      if (!c) continue;
      if (c.link) {
        const target = out.boards[c.link];
        c.label = target ? nameById(c.link, c.label) : c.label;
        continue;
      }
      // Going back to English: use the remembered original word when there is one.
      const hit = to === 'en' && c.key ? ([c.key, c.key] as Pair) : words.get(lower(c.label));
      if (hit) {
        if (to === 'es' && !c.key) c.key = c.label;
        if (to === 'en') delete c.key;
        c.label = hit[0];
        if (hit[1] !== hit[0]) c.speak = hit[1];
        else delete c.speak;
        delete c.forms; // forms are language-specific
      }
    }
  }
  for (const q of out.quickBar) {
    const hit = to === 'en' && q.key ? ([q.key, q.key] as Pair) : words.get(lower(q.label));
    if (hit) { if (to === 'es' && !q.key) q.key = q.label; if (to === 'en') delete q.key; q.label = hit[0]; if (hit[1] !== hit[0]) q.speak = hit[1]; else delete q.speak; }
  }
  out.phrases = out.phrases.map((ph) => ({ ...ph, text: phrases[ph.text] ?? ph.text, category: phraseCats[ph.category] ?? ph.category }));
  out.phraseCategories = out.phraseCategories.map((c) => phraseCats[c] ?? c);
  out.schedules = out.schedules.map((s) => ({
    ...s,
    name: sched[s.name] ?? s.name,
    steps: s.steps.map((st) => ({ ...st, label: sched[st.label] ?? words.get(lower(st.label))?.[0] ?? st.label })),
  }));
  out.settings = { ...out.settings, language: to, lang: to === 'es' ? 'es-US' : 'en-US', voiceURI: undefined, voiceIndex: undefined, voiceName: undefined };
  out.lexicon = {};
  return out;
}

/** Spanish label for a built-in library symbol (used to localise the symbol library). */
export function localLabel(en: string, lang: Lang): string {
  if (lang === 'en') return en;
  const v = ES_LABELS[en] ?? ES_LABELS[lower(en)];
  return v ? (Array.isArray(v) ? v[0] : v) : en;
}
export function localCategory(id: string, name: string, lang: Lang): string {
  if (lang === 'en') return name;
  return ES_CATEGORY_NAMES[id.replace(/^lib-/, '')] ?? name;
}
