/**
 * Language packs. Each pack bundles everything Caleb needs to talk in a
 * language: interface strings, board vocabulary (keyed by the English
 * originals), grammar, keyboard, prediction and body-map phrasing.
 * English is the source language, so its vocab maps are empty.
 *
 * To add a language: create src/i18n/<id>.ts (UI), src/data/i18n/<id>-vocab.ts
 * and <id>-words.ts (copy the Spanish ones), a morphology module, and add a
 * pack below.
 */
import { ES_UI } from './es';
import { FR_UI } from './fr';
import { PT_UI } from './pt';
import { ES_CATEGORY_NAMES, ES_LABELS, ES_PHRASE_CATEGORIES, ES_PHRASES, ES_SCHEDULE } from '../data/i18n/es-vocab';
import { FR_CATEGORY_NAMES, FR_LABELS, FR_PHRASE_CATEGORIES, FR_PHRASES, FR_SCHEDULE } from '../data/i18n/fr-vocab';
import { PT_CATEGORY_NAMES, PT_LABELS, PT_PHRASE_CATEGORIES, PT_PHRASES, PT_SCHEDULE } from '../data/i18n/pt-vocab';
import { ES_BIGRAMS, ES_COMMON_WORDS } from '../data/i18n/es-words';
import { FR_BIGRAMS, FR_COMMON_WORDS } from '../data/i18n/fr-words';
import { PT_BIGRAMS, PT_COMMON_WORDS } from '../data/i18n/pt-words';
import { COMMON_WORDS } from '../data/words';
import { BIGRAMS } from '../data/bigrams';
import { autoConjugate as autoConjugateEs, formsForEs, isInfinitive, pluralEs, verbFormsEs } from '../lib/morphology-es';
import { autoConjugateFr, formsForFr, pluralFr } from '../lib/morphology-fr';
import { autoConjugatePt, formsForPt, pluralPt, verbFormsPt, isInfinitivePt } from '../lib/morphology-pt';

export type Lang = 'en' | 'es' | 'fr' | 'pt';

export interface VocabPack {
  labels: Record<string, string | [string, string]>;
  categories: Record<string, string>;
  phrases: Record<string, string>;
  phraseCategories: Record<string, string>;
  schedule: Record<string, string>;
  /** Names for the built-in Home board, the library's core category and "My extra symbols". */
  home: string;
  core: string;
  extra: string;
  aboutMe: (name: string) => string;
}

export type BodyFeel = 'hurts' | 'is itchy' | 'feels funny' | 'is bleeding';

export interface LangPack {
  id: Lang;
  /** Name in its own language. */
  name: string;
  voice: string;
  ui: Record<string, string>;
  vocab?: VocabPack;
  words: string[];
  bigrams: Record<string, string[]>;
  starters: string[];
  keyboard: { qwerty: string[]; abc: string[]; nums: string[]; azerty?: string[] };
  /** Other forms of a word for the word-forms popover (null = use English rules). */
  forms?: (word: string, type?: string) => string[];
  /** Quick endings (+s / +ing / +ed buttons). */
  ending?: (word: string, ending: 's' | 'ing' | 'ed') => string;
  autoConjugate?: (prev: string[], verb: string) => { text: string; dropPrevious: number } | null;
  /** Body map: part → [button label, spoken sentence per feeling]. */
  body?: { part: (id: string) => string; say: (id: string, feel: BodyFeel) => string; feel: (f: BodyFeel) => string };
}

const EN_KB = { qwerty: ['qwertyuiop', "asdfghjkl'", 'zxcvbnm'], abc: ['abcdefghi', 'jklmnopqr', "stuvwxyz'"], nums: ['1234567890', '-/:;()$&@"', ".,?!'#%+="] };

// ---------- Spanish ----------
const ES_PART: Record<string, [string, string]> = {
  head: ['cabeza', 'la cabeza'], eyes: ['ojos', 'los ojos'], ears: ['oídos', 'los oídos'], nose: ['nariz', 'la nariz'],
  mouth: ['boca', 'la boca'], teeth: ['dientes', 'los dientes'], throat: ['garganta', 'la garganta'], neck: ['cuello', 'el cuello'],
  chest: ['pecho', 'el pecho'], tummy: ['panza', 'la panza'], back: ['espalda', 'la espalda'], arm: ['brazo', 'el brazo'],
  hand: ['mano', 'la mano'], finger: ['dedo', 'el dedo'], leg: ['pierna', 'la pierna'], knee: ['rodilla', 'la rodilla'],
  foot: ['pie', 'el pie'], toes: ['dedos del pie', 'los dedos del pie'], skin: ['piel', 'la piel'], bottom: ['pompis', 'las pompis'],
};
const esPlural = (id: string) => /^(los|las) /.test(ES_PART[id]?.[1] ?? '');

// ---------- French ----------
// [label, "à" form, "de" form, plural]
const FR_PART: Record<string, [string, string, string, boolean]> = {
  head: ['tête', 'à la tête', 'de la tête', false], eyes: ['yeux', 'aux yeux', 'des yeux', true], ears: ['oreilles', 'aux oreilles', 'des oreilles', true],
  nose: ['nez', 'au nez', 'du nez', false], mouth: ['bouche', 'à la bouche', 'de la bouche', false], teeth: ['dents', 'aux dents', 'des dents', true],
  throat: ['gorge', 'à la gorge', 'de la gorge', false], neck: ['cou', 'au cou', 'du cou', false], chest: ['poitrine', 'à la poitrine', 'de la poitrine', false],
  tummy: ['ventre', 'au ventre', 'du ventre', false], back: ['dos', 'au dos', 'du dos', false], arm: ['bras', 'au bras', 'du bras', false],
  hand: ['main', 'à la main', 'de la main', false], finger: ['doigt', 'au doigt', 'du doigt', false], leg: ['jambe', 'à la jambe', 'de la jambe', false],
  knee: ['genou', 'au genou', 'du genou', false], foot: ['pied', 'au pied', 'du pied', false], toes: ['orteils', 'aux orteils', 'des orteils', true],
  skin: ['peau', 'à la peau', 'de la peau', false], bottom: ['fesses', 'aux fesses', 'des fesses', true],
};

// ---------- Portuguese ----------
// [label, possessive phrase, plural, "em" form]
const PT_PART: Record<string, [string, string, boolean, string]> = {
  head: ['cabeça', 'Minha cabeça', false, 'na cabeça'], eyes: ['olhos', 'Meus olhos', true, 'nos olhos'], ears: ['ouvidos', 'Meus ouvidos', true, 'nos ouvidos'],
  nose: ['nariz', 'Meu nariz', false, 'no nariz'], mouth: ['boca', 'Minha boca', false, 'na boca'], teeth: ['dentes', 'Meus dentes', true, 'nos dentes'],
  throat: ['garganta', 'Minha garganta', false, 'na garganta'], neck: ['pescoço', 'Meu pescoço', false, 'no pescoço'], chest: ['peito', 'Meu peito', false, 'no peito'],
  tummy: ['barriga', 'Minha barriga', false, 'na barriga'], back: ['costas', 'Minhas costas', true, 'nas costas'], arm: ['braço', 'Meu braço', false, 'no braço'],
  hand: ['mão', 'Minha mão', false, 'na mão'], finger: ['dedo', 'Meu dedo', false, 'no dedo'], leg: ['perna', 'Minha perna', false, 'na perna'],
  knee: ['joelho', 'Meu joelho', false, 'no joelho'], foot: ['pé', 'Meu pé', false, 'no pé'], toes: ['dedos do pé', 'Meus dedos do pé', true, 'nos dedos do pé'],
  skin: ['pele', 'Minha pele', false, 'na pele'], bottom: ['bumbum', 'Meu bumbum', false, 'no bumbum'],
};

export const PACKS: Record<Lang, LangPack> = {
  en: {
    id: 'en', name: 'English', voice: 'en-US', ui: {},
    words: COMMON_WORDS, bigrams: BIGRAMS,
    starters: ['I', 'you', 'can', 'what', 'want', 'my', 'it', 'is', 'the', 'please'],
    keyboard: { ...EN_KB, azerty: ['azertyuiop', "qsdfghjklm", "wxcvbn'"] },
  },
  es: {
    id: 'es', name: 'Español', voice: 'es-US', ui: ES_UI,
    vocab: {
      labels: ES_LABELS, categories: ES_CATEGORY_NAMES, phrases: ES_PHRASES, phraseCategories: ES_PHRASE_CATEGORIES, schedule: ES_SCHEDULE,
      home: 'Inicio', core: 'Palabras básicas', extra: 'Mis símbolos extra',
      aboutMe: (n) => `¡Hola! Me llamo ${n || '…'}. Soy autista y uso esta aplicación para comunicarme. Por favor, ten paciencia y dame más tiempo para responder. Entiendo más de lo que puedo decir.`,
    },
    words: ES_COMMON_WORDS, bigrams: ES_BIGRAMS,
    starters: ['yo', 'quiero', 'más', 'no', 'sí', 'qué', 'me', 'por', 'tú', 'mi'],
    keyboard: { qwerty: ['áéíóúü', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm'], abc: ['áéíóúü', 'abcdefghi', 'jklmnñopq', 'rstuvwxyz'], nums: ['1234567890', '-/:;()$&@"', ".,¿?¡!'%+="] },
    forms: formsForEs,
    ending: (w, e) => (e === 's' ? pluralEs(w) : isInfinitive(w) ? verbFormsEs(w)[e === 'ing' ? 7 : 5] : w),
    autoConjugate: autoConjugateEs,
    body: {
      part: (id) => ES_PART[id]?.[0] ?? id,
      feel: (f) => ({ hurts: 'duele', 'is itchy': 'pica', 'feels funny': 'se siente raro', 'is bleeding': 'sangra' }[f]),
      say: (id, f) => {
        const p = ES_PART[id]?.[1] ?? id;
        const pl = esPlural(id);
        return { hurts: `Me duele${pl ? 'n' : ''} ${p}.`, 'is itchy': `Me pica${pl ? 'n' : ''} ${p}.`, 'feels funny': `Siento algo raro en ${p}.`, 'is bleeding': `Me sangra${pl ? 'n' : ''} ${p}.` }[f];
      },
    },
  },
  fr: {
    id: 'fr', name: 'Français', voice: 'fr-FR', ui: FR_UI,
    vocab: {
      labels: FR_LABELS, categories: FR_CATEGORY_NAMES, phrases: FR_PHRASES, phraseCategories: FR_PHRASE_CATEGORIES, schedule: FR_SCHEDULE,
      home: 'Accueil', core: 'Mots de base', extra: 'Mes pictogrammes en plus',
      aboutMe: (n) => `Bonjour ! Je m'appelle ${n || '…'}. Je suis autiste et j'utilise cette application pour communiquer. Merci de votre patience : laissez-moi plus de temps pour répondre. Je comprends plus de choses que je ne peux en dire.`,
    },
    words: FR_COMMON_WORDS, bigrams: FR_BIGRAMS,
    starters: ['je', 'veux', 'encore', 'non', 'oui', 'quoi', 'tu', 'mon', 'il', 'est'],
    keyboard: {
      qwerty: ['éèêàçùôî', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm'],
      azerty: ['éèêàçùôî', 'azertyuiop', 'qsdfghjklm', "wxcvbn'"],
      abc: ['éèêàçùôî', 'abcdefghi', 'jklmnopqr', "stuvwxyz'"],
      nums: ['1234567890', '-/:;()€&@"', ".,?!'«»%+"],
    },
    forms: formsForFr,
    ending: (w, e) => (e === 's' ? pluralFr(w) : w),
    autoConjugate: autoConjugateFr,
    body: {
      part: (id) => FR_PART[id]?.[0] ?? id,
      feel: (f) => ({ hurts: "j'ai mal", 'is itchy': 'ça gratte', 'feels funny': 'bizarre', 'is bleeding': 'je saigne' }[f]),
      say: (id, f) => {
        const [, a, de] = FR_PART[id] ?? [id, id, id, false];
        return { hurts: `J'ai mal ${a}.`, 'is itchy': `Ça me gratte ${a}.`, 'feels funny': `J'ai une sensation bizarre ${a}.`, 'is bleeding': `Je saigne ${de}.` }[f];
      },
    },
  },
  pt: {
    id: 'pt', name: 'Português (Brasil)', voice: 'pt-BR', ui: PT_UI,
    vocab: {
      labels: PT_LABELS, categories: PT_CATEGORY_NAMES, phrases: PT_PHRASES, phraseCategories: PT_PHRASE_CATEGORIES, schedule: PT_SCHEDULE,
      home: 'Início', core: 'Palavras essenciais', extra: 'Meus símbolos extras',
      aboutMe: (n) => `Oi! Meu nome é ${n || '…'}. Sou autista e uso este aplicativo para me comunicar. Por favor, tenha paciência e me dê mais tempo para responder. Eu entendo mais do que consigo falar.`,
    },
    words: PT_COMMON_WORDS, bigrams: PT_BIGRAMS,
    starters: ['eu', 'quero', 'mais', 'não', 'sim', 'o que', 'você', 'meu', 'é', 'por favor'],
    keyboard: { qwerty: ['áâãàçéêíóôõú', 'qwertyuiop', 'asdfghjklç', 'zxcvbnm'], abc: ['áâãàçéêíóôõú', 'abcdefghi', 'jklmnopqr', 'stuvwxyz'], nums: ['1234567890', '-/:;()R$&@"', ".,?!'%+="] },
    forms: formsForPt,
    ending: (w, e) => (e === 's' ? pluralPt(w) : isInfinitivePt(w) ? verbFormsPt(w)[e === 'ing' ? 7 : 5] : w),
    autoConjugate: autoConjugatePt,
    body: {
      part: (id) => PT_PART[id]?.[0] ?? id,
      feel: (f) => ({ hurts: 'dói', 'is itchy': 'coça', 'feels funny': 'estranho', 'is bleeding': 'sangrando' }[f]),
      say: (id, f) => {
        const [, poss, pl, em] = PT_PART[id] ?? [id, id, false, id];
        return { hurts: `${poss} ${pl ? 'doem' : 'dói'}.`, 'is itchy': `${poss} ${pl ? 'coçam' : 'coça'}.`, 'feels funny': `Sinto algo estranho ${em}.`, 'is bleeding': `${poss} ${pl ? 'estão' : 'está'} sangrando.` }[f];
      },
    },
  },
};

export const LANGUAGES = (Object.values(PACKS) as LangPack[]).map((p) => ({ id: p.id, name: p.name, voice: p.voice }));
export const isLang = (x: unknown): x is Lang => typeof x === 'string' && x in PACKS;
