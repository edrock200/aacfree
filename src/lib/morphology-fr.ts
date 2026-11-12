/**
 * French word forms: plurals, adjective agreement and present-tense
 * conjugation with elision ("je" + "aimer" → "j'aime").
 *
 * Verbs are handled in layers, most specific first:
 *  1. irregular verbs (IRR) and their prefixed compounds (revenir ← venir,
 *     s'endormir ← dormir, permettre ← mettre…);
 *  2. families: -indre (éteins, éteignons, éteint), -aître, -uire, -cevoir,
 *     -vrir/-frir, 3rd-group -ir like partir;
 *  3. spelling rules for -er verbs: -ger (mangeons), -cer (lançons),
 *     e/é → è (enlève, préfère), -oyer/-uyer/-ayer (nettoie, paie),
 *     -eler/-eter doubling (appelle, jette);
 *  4. regular -er / -ir (finir) / -re (attendre) endings.
 * Reflexive verbs ("se lever", "s'habiller") carry their pronoun:
 * me lève, je vais me lever; the participle drops it (levé, habillé).
 */

// 0 je, 1 tu, 2 il/elle/on, 3 nous, 4 vous, 5 ils/elles
export const SUBJECTS_FR: Record<string, number> = {
  je: 0, "j'": 0, tu: 1, il: 2, elle: 2, on: 2, 'ça': 2, nous: 3, vous: 4, ils: 5, elles: 5,
};

const IRR: Record<string, { pres: string[]; part?: string }> = {
  'être': { pres: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], part: 'été' },
  avoir: { pres: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], part: 'eu' },
  aller: { pres: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], part: 'allé' },
  faire: { pres: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'], part: 'fait' },
  vouloir: { pres: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], part: 'voulu' },
  pouvoir: { pres: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], part: 'pu' },
  devoir: { pres: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'], part: 'dû' },
  savoir: { pres: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], part: 'su' },
  valoir: { pres: ['vaux', 'vaux', 'vaut', 'valons', 'valez', 'valent'], part: 'valu' },
  prendre: { pres: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], part: 'pris' },
  venir: { pres: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], part: 'venu' },
  tenir: { pres: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'], part: 'tenu' },
  voir: { pres: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], part: 'vu' },
  croire: { pres: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'], part: 'cru' },
  dire: { pres: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], part: 'dit' },
  lire: { pres: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'], part: 'lu' },
  rire: { pres: ['ris', 'ris', 'rit', 'rions', 'riez', 'rient'], part: 'ri' },
  sourire: { pres: ['souris', 'souris', 'sourit', 'sourions', 'souriez', 'sourient'], part: 'souri' },
  écrire: { pres: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'], part: 'écrit' },
  mettre: { pres: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'], part: 'mis' },
  battre: { pres: ['bats', 'bats', 'bat', 'battons', 'battez', 'battent'], part: 'battu' },
  boire: { pres: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'], part: 'bu' },
  suivre: { pres: ['suis', 'suis', 'suit', 'suivons', 'suivez', 'suivent'], part: 'suivi' },
  vivre: { pres: ['vis', 'vis', 'vit', 'vivons', 'vivez', 'vivent'], part: 'vécu' },
  plaire: { pres: ['plais', 'plais', 'plaît', 'plaisons', 'plaisez', 'plaisent'], part: 'plu' },
  rompre: { pres: ['romps', 'romps', 'rompt', 'rompons', 'rompez', 'rompent'], part: 'rompu' },
  vaincre: { pres: ['vaincs', 'vaincs', 'vainc', 'vainquons', 'vainquez', 'vainquent'], part: 'vaincu' },
  coudre: { pres: ['couds', 'couds', 'coud', 'cousons', 'cousez', 'cousent'], part: 'cousu' },
  conclure: { pres: ['conclus', 'conclus', 'conclut', 'concluons', 'concluez', 'concluent'], part: 'conclu' },
  naître: { pres: ['nais', 'nais', 'naît', 'naissons', 'naissez', 'naissent'], part: 'né' },
  dormir: { pres: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'], part: 'dormi' },
  sortir: { pres: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'], part: 'sorti' },
  partir: { pres: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'], part: 'parti' },
  sentir: { pres: ['sens', 'sens', 'sent', 'sentons', 'sentez', 'sentent'], part: 'senti' },
  mentir: { pres: ['mens', 'mens', 'ment', 'mentons', 'mentez', 'mentent'], part: 'menti' },
  servir: { pres: ['sers', 'sers', 'sert', 'servons', 'servez', 'servent'], part: 'servi' },
  courir: { pres: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'], part: 'couru' },
  mourir: { pres: ['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'], part: 'mort' },
  cueillir: { pres: ['cueille', 'cueilles', 'cueille', 'cueillons', 'cueillez', 'cueillent'], part: 'cueilli' },
  fuir: { pres: ['fuis', 'fuis', 'fuit', 'fuyons', 'fuyez', 'fuient'], part: 'fui' },
  acquérir: { pres: ['acquiers', 'acquiers', 'acquiert', 'acquérons', 'acquérez', 'acquièrent'], part: 'acquis' },
  asseoir: { pres: ['assieds', 'assieds', 'assied', 'asseyons', 'asseyez', 'asseyent'], part: 'assis' },
  appeler: { pres: ['appelle', 'appelles', 'appelle', 'appelons', 'appelez', 'appellent'], part: 'appelé' },
  rappeler: { pres: ['rappelle', 'rappelles', 'rappelle', 'rappelons', 'rappelez', 'rappellent'], part: 'rappelé' },
  jeter: { pres: ['jette', 'jettes', 'jette', 'jetons', 'jetez', 'jettent'], part: 'jeté' },
  pleuvoir: { pres: ['pleut', 'pleut', 'pleut', 'pleut', 'pleut', 'pleut'], part: 'plu' },
  falloir: { pres: ['faut', 'faut', 'faut', 'faut', 'faut', 'faut'], part: 'fallu' },
};

/** Roots whose prefixed compounds conjugate the same way. */
const COMPOUND_ROOTS = ['prendre', 'venir', 'tenir', 'mettre', 'faire', 'voir', 'dormir', 'sortir', 'partir', 'sentir',
  'mentir', 'servir', 'courir', 'battre', 'suivre', 'vivre', 'écrire', 'lire', 'dire', 'jeter'];
const PREFIXES = ['re', 'ré', 'res', 'de', 'dé', 'des', 'd', 'sou', 'sur', 'com', 'ap', 'appar', 'ad', 'per', 'pro', 'pré',
  'pres', 'ob', 'main', 'con', 'en', 'ren', 'par', 'ac', 'se', 'entre', 'inter', 'é', 'satis', 'pour', 'sous'];
/** "dire" compounds other than "redire" have "-disez" (interdisez, prédisez): leave them alone. */
const ONLY_RE = new Set(['dire']);

/** Verbs starting with an aspirated h: no elision ("je hurle", "se hisser"). */
const H_ASPIRE = /^(hurl|ha[iï]r|hach|hauss|heurt|hiss|hu[eé]|hant|harcel|hél|hoch|hennir|hériss|hât|hasard)/;
const vowelStart = (w: string) => /^[aeiouyhàâéèêëîïôûü]/i.test(w) && !H_ASPIRE.test(w.toLowerCase());

export function isInfinitiveFr(w: string) {
  const head = w.trim().replace(/^se\s+|^s'/, '').split(' ')[0];
  // Nouns in -oire (balançoire, histoire) are not verbs; boire and croire are.
  return /(er|ir|re|oir)$/.test(head) && (!/oire$/.test(head) || /^(re)?(boire|croire)$/.test(head)) && head.length > 2;
}

interface Parsed { head: string; reflexive: boolean; tail: string }
function parse(verb: string): Parsed {
  const words = verb.trim().split(/\s+/);
  let reflexive = false;
  if (words[0] === 'se' && words.length > 1) { reflexive = true; words.shift(); }
  else if (/^s['’]/.test(words[0])) { reflexive = true; words[0] = words[0].slice(2); }
  const [head, ...rest] = words;
  return { head, reflexive, tail: rest.length ? ' ' + rest.join(' ') : '' };
}

function compound(head: string): { prefix: string; root: string } | null {
  for (const root of COMPOUND_ROOTS) {
    if (head.length <= root.length || !head.endsWith(root)) continue;
    const prefix = head.slice(0, -root.length);
    if (PREFIXES.includes(prefix) && (!ONLY_RE.has(root) || prefix === 're')) return { prefix, root };
  }
  return null;
}

/** Second-group -ir verbs that look like third-group ones are listed in IRR; everything else in -ir is finir-like. */
interface Paradigm { pres: string[]; part: string }

function paradigm(head: string): Paradigm {
  const irr = IRR[head];
  if (irr) return { pres: irr.pres, part: irr.part ?? head };
  const c = compound(head);
  if (c) {
    const r = paradigm(c.root);
    return { pres: r.pres.map((x) => c.prefix + x), part: c.prefix + r.part };
  }
  // -indre: éteindre, peindre, craindre, joindre
  if (/[aeo]indre$/.test(head)) {
    const s = head.slice(0, -4); // éte(indre) → "étei" + n…
    return { pres: [s + 'ns', s + 'ns', s + 'nt', s + 'gnons', s + 'gnez', s + 'gnent'], part: s + 'nt' };
  }
  // -aître: connaître, paraître, disparaître
  if (/aître$/.test(head)) {
    const s = head.slice(0, -5);
    return { pres: [s + 'ais', s + 'ais', s + 'aît', s + 'aissons', s + 'aissez', s + 'aissent'], part: s + 'u' };
  }
  // -uire: conduire, construire, détruire, produire, cuire
  if (/uire$/.test(head)) {
    const s = head.slice(0, -2);
    return { pres: [s + 's', s + 's', s + 't', s + 'sons', s + 'sez', s + 'sent'], part: s + 't' };
  }
  // -cevoir: recevoir, apercevoir, décevoir
  if (/cevoir$/.test(head)) {
    const s = head.slice(0, -6);
    return { pres: [s + 'çois', s + 'çois', s + 'çoit', s + 'cevons', s + 'cevez', s + 'çoivent'], part: s + 'çu' };
  }
  // -vrir/-frir: ouvrir, couvrir, découvrir, offrir, souffrir
  if (/(vr|fr)ir$/.test(head)) {
    const s = head.slice(0, -2);
    return { pres: [s + 'e', s + 'es', s + 'e', s + 'ons', s + 'ez', s + 'ent'], part: s.slice(0, -1) + 'ert' };
  }
  if (head.endsWith('er')) {
    const stem = head.slice(0, -2);
    const nous = /g$/.test(stem) ? stem + 'eons' : /c$/.test(stem) ? stem.slice(0, -1) + 'çons' : stem + 'ons';
    // Stem used before a silent ending (je, tu, il, ils).
    let mute = stem;
    if (/[ou]y$/.test(stem) || /ay$/.test(stem)) mute = stem.slice(0, -1) + 'i'; // nettoie, essuie, paie
    else if (/[eé](?:[bcdfgjklmnpqrstvz]|ch|gn|gu|qu|[bcdfgptv][rl])$/.test(stem)) {
      // enlever → enlève, préférer → préfère, acheter → achète (but créer, agréer stay)
      mute = stem.replace(/[eé]((?:[bcdfgjklmnpqrstvz]|ch|gn|gu|qu|[bcdfgptv][rl]))$/, 'è$1');
    }
    return { pres: [mute + 'e', mute + 'es', mute + 'e', nous, stem + 'ez', mute + 'ent'], part: stem + 'é' };
  }
  if (head.endsWith('ir')) {
    const s = head.slice(0, -2);
    return { pres: [s + 'is', s + 'is', s + 'it', s + 'issons', s + 'issez', s + 'issent'], part: s + 'i' };
  }
  if (head.endsWith('re')) {
    const s = head.slice(0, -2);
    // attendre → il attend; other -re verbs add a t (il rompt is in IRR).
    const third = /d$/.test(s) ? s : s + 't';
    return { pres: [s + 's', s + 's', third, s + 'ons', s + 'ez', s + 'ent'], part: s + 'u' };
  }
  return { pres: [head, head, head, head, head, head], part: head };
}

/** Pronoun before a verb form, elided before a vowel: me lève, m'habille. */
function withPronoun(pro: string, form: string): string {
  return (pro === 'me' || pro === 'te' || pro === 'se') && vowelStart(form) ? pro[0] + "'" + form : pro + ' ' + form;
}

export function conjugateFr(verb: string, person: number): string {
  const { head, reflexive, tail } = parse(verb);
  let form = paradigm(head).pres[person];
  if (reflexive) form = withPronoun(['me', 'te', 'se', 'nous', 'vous', 'se'][person], form);
  return form + tail;
}

/** Past participle (without any reflexive pronoun), with the rest of a multi-word verb. */
export function participleFr(verb: string): string {
  const { head, tail } = parse(verb);
  return paradigm(head).part + tail;
}

/** Near future in the first person: "je vais manger", "je vais me lever", "je vais m'habiller". */
export function futureFr(verb: string): string {
  const { head, reflexive, tail } = parse(verb);
  return 'je vais ' + (reflexive ? withPronoun('me', head) : head) + tail;
}

export function pluralFr(noun: string): string {
  const w = noun.trim();
  if (/[sxz]$/i.test(w)) return w;
  if (/(eau|au|eu)$/i.test(w)) return w + 'x';
  if (/al$/i.test(w) && !/(bal|festival|carnaval|chacal)$/i.test(w)) return w.slice(0, -2) + 'aux';
  return w + 's';
}

export function adjectiveFormsFr(adj: string): string[] {
  const w = adj.trim();
  const fem = /e$/.test(w) ? w : /eux$/.test(w) ? w.slice(0, -1) + 'se' : /if$/.test(w) ? w.slice(0, -1) + 've' : /(el|on|en)$/.test(w) ? w + w.slice(-1) + 'e' : w + 'e';
  return [...new Set([fem, pluralFr(w), pluralFr(fem), 'très ' + w, 'plus ' + w])].filter((x) => x !== w);
}

const NO_FORMS = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi', 'oui', 'non', 'et', 'ou', 'le', 'la', 'les', 'un', 'une', 'de', 'à']);

/** Forms for the popover: [je, tu, il, nous, vous, ils, participle, "je vais …"] (duplicates removed). */
export function verbFormsFr(verb: string): string[] {
  return [...[0, 1, 2, 3, 4, 5].map((p) => conjugateFr(verb, p)), participleFr(verb), futureFr(verb)];
}

export function formsForFr(word: string, type?: string): string[] {
  const w = word.trim();
  if (!w || NO_FORMS.has(w.toLowerCase())) return [];
  if (type === 'verb' && isInfinitiveFr(w)) return [...new Set(verbFormsFr(w))].filter((x) => x !== w);
  if (type === 'noun' || type === 'folder') return w.includes(' ') ? [] : [pluralFr(w)].filter((x) => x !== w);
  if (type === 'descriptor') return w.includes(' ') ? [] : adjectiveFormsFr(w);
  return [];
}

/** "je" + "vouloir" → "veux"; "je" + "aimer" → "j'aime" (replaces the pronoun). */
export function autoConjugateFr(prev: string[], verb: string): { text: string; dropPrevious: number } | null {
  if (!isInfinitiveFr(verb)) return null;
  const subj = prev[prev.length - 1]?.toLowerCase();
  if (subj === undefined || !(subj in SUBJECTS_FR)) return null;
  const person = SUBJECTS_FR[subj];
  const form = conjugateFr(verb, person);
  if (person === 0 && vowelStart(form)) return { text: "j'" + form, dropPrevious: 1 };
  return { text: form, dropPrevious: 0 };
}
