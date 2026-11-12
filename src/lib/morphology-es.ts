/**
 * Spanish word forms: plurals, adjective gender/number and verb conjugation
 * (present, preterite, gerund, participle). Used for the word-forms popover and
 * for automatic conjugation after a subject pronoun ("yo" + "querer" → "quiero").
 *
 * Verbs are handled in layers, most specific first:
 *  1. fully irregular verbs (IRREGULAR), and their prefixed compounds
 *     (sostener ← tener, perseguir ← seguir, devolver ← volver…);
 *  2. stem-changing verbs (STEM: e→ie, o→ue, u→ue, e→i), including the
 *     -ir change in the preterite and gerund (sintió, durmiendo, pidió);
 *  3. spelling rules: -ger/-gir → -jo, -guir → -go, -cer/-cir → -zco/-zo,
 *     -uir → -uyo, -car/-gar/-zar → -qué/-gué/-cé, vowel stems → leyó/leyendo/leído,
 *     stressed -iar/-uar (envío, continúo);
 *  4. regular endings.
 * Reflexive verbs ("vestirse", "lavarse los dientes") carry their pronoun in
 * every form: me visto, me vestí, vistiéndome, voy a vestirme.
 */

// Person index: 0 yo, 1 tú, 2 él/ella/usted, 3 nosotros, 4 ellos/ustedes
export const SUBJECTS: Record<string, number> = {
  yo: 0, 'tú': 1, tu: 1, 'él': 2, ella: 2, usted: 2, eso: 2, esto: 2, nosotros: 3, nosotras: 3,
  ellos: 4, ellas: 4, ustedes: 4,
};

interface Irr { pres?: string[]; pret?: [string, string]; ger?: string; part?: string }

/** Present tense (5 persons), preterite (yo, él), gerund, participle. */
const IRREGULAR: Record<string, Irr> = {
  ser: { pres: ['soy', 'eres', 'es', 'somos', 'son'], pret: ['fui', 'fue'] },
  estar: { pres: ['estoy', 'estás', 'está', 'estamos', 'están'], pret: ['estuve', 'estuvo'] },
  ir: { pres: ['voy', 'vas', 'va', 'vamos', 'van'], pret: ['fui', 'fue'], ger: 'yendo' },
  haber: { pres: ['he', 'has', 'ha', 'hemos', 'han'], pret: ['hube', 'hubo'] },
  tener: { pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen'], pret: ['tuve', 'tuvo'] },
  querer: { pres: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'], pret: ['quise', 'quiso'] },
  poder: { pres: ['puedo', 'puedes', 'puede', 'podemos', 'pueden'], pret: ['pude', 'pudo'], ger: 'pudiendo' },
  hacer: { pres: ['hago', 'haces', 'hace', 'hacemos', 'hacen'], pret: ['hice', 'hizo'], part: 'hecho' },
  decir: { pres: ['digo', 'dices', 'dice', 'decimos', 'dicen'], pret: ['dije', 'dijo'], ger: 'diciendo', part: 'dicho' },
  venir: { pres: ['vengo', 'vienes', 'viene', 'venimos', 'vienen'], pret: ['vine', 'vino'], ger: 'viniendo' },
  poner: { pres: ['pongo', 'pones', 'pone', 'ponemos', 'ponen'], pret: ['puse', 'puso'], part: 'puesto' },
  salir: { pres: ['salgo', 'sales', 'sale', 'salimos', 'salen'] },
  valer: { pres: ['valgo', 'vales', 'vale', 'valemos', 'valen'] },
  ver: { pres: ['veo', 'ves', 've', 'vemos', 'ven'], pret: ['vi', 'vio'], part: 'visto' },
  dar: { pres: ['doy', 'das', 'da', 'damos', 'dan'], pret: ['di', 'dio'] },
  saber: { pres: ['sé', 'sabes', 'sabe', 'sabemos', 'saben'], pret: ['supe', 'supo'] },
  caber: { pres: ['quepo', 'cabes', 'cabe', 'cabemos', 'caben'], pret: ['cupe', 'cupo'] },
  andar: { pret: ['anduve', 'anduvo'] },
  traer: { pres: ['traigo', 'traes', 'trae', 'traemos', 'traen'], pret: ['traje', 'trajo'] },
  caer: { pres: ['caigo', 'caes', 'cae', 'caemos', 'caen'] },
  oír: { pres: ['oigo', 'oyes', 'oye', 'oímos', 'oyen'] },
  reír: { pres: ['río', 'ríes', 'ríe', 'reímos', 'ríen'], pret: ['reí', 'rio'], ger: 'riendo', part: 'reído' },
  sonreír: { pres: ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonríen'], pret: ['sonreí', 'sonrió'], ger: 'sonriendo', part: 'sonreído' },
  freír: { pres: ['frío', 'fríes', 'fríe', 'freímos', 'fríen'], pret: ['freí', 'frió'], ger: 'friendo', part: 'frito' },
  oler: { pres: ['huelo', 'hueles', 'huele', 'olemos', 'huelen'] },
  morir: { part: 'muerto' },
  escribir: { part: 'escrito' },
  abrir: { part: 'abierto' },
  cubrir: { part: 'cubierto' },
  romper: { part: 'roto' },
  volver: { part: 'vuelto' },
  resolver: { part: 'resuelto' },
  imprimir: { part: 'impreso' },
  mecer: { pres: ['mezo', 'meces', 'mece', 'mecemos', 'mecen'] },
  cocer: { pres: ['cuezo', 'cueces', 'cuece', 'cocemos', 'cuecen'] },
  llover: { pres: ['llueve', 'llueve', 'llueve', 'llueve', 'llueve'] },
  nevar: { pres: ['nieva', 'nieva', 'nieva', 'nieva', 'nieva'] },
};

/** Stem-changing verbs (the vowel of the last stem syllable changes when stressed). */
const STEM: Record<string, 'ie' | 'ue' | 'i'> = {
  // e → ie
  pensar: 'ie', cerrar: 'ie', empezar: 'ie', comenzar: 'ie', despertar: 'ie', sentar: 'ie', calentar: 'ie',
  merendar: 'ie', recomendar: 'ie', regar: 'ie', fregar: 'ie', negar: 'ie', apretar: 'ie', confesar: 'ie',
  entender: 'ie', perder: 'ie', encender: 'ie', defender: 'ie', atender: 'ie', querer: 'ie',
  sentir: 'ie', preferir: 'ie', mentir: 'ie', divertir: 'ie', convertir: 'ie', hervir: 'ie', herir: 'ie', sugerir: 'ie', advertir: 'ie', invertir: 'ie', arrepentir: 'ie',
  // o → ue (u → ue for jugar)
  contar: 'ue', mostrar: 'ue', probar: 'ue', encontrar: 'ue', almorzar: 'ue', acostar: 'ue', recordar: 'ue',
  costar: 'ue', soñar: 'ue', volar: 'ue', sonar: 'ue', colgar: 'ue', soltar: 'ue', rogar: 'ue', jugar: 'ue',
  volver: 'ue', mover: 'ue', doler: 'ue', poder: 'ue', llover: 'ue', resolver: 'ue', torcer: 'ue', morder: 'ue',
  dormir: 'ue', morir: 'ue',
  // e → i
  pedir: 'i', servir: 'i', vestir: 'i', repetir: 'i', seguir: 'i', medir: 'i', elegir: 'i', corregir: 'i', competir: 'i',
};

/** Roots whose prefixed compounds conjugate the same way (sostener, perseguir, devolver…). */
const COMPOUND_ROOTS = ['tener', 'poner', 'venir', 'hacer', 'decir', 'traer', 'seguir', 'pedir', 'volver', 'mover',
  'contar', 'probar', 'mostrar', 'cerrar', 'sentir', 'servir', 'vestir', 'coger', 'cubrir', 'escribir'];
const PREFIXES = ['re', 'des', 'de', 'sos', 'man', 'ob', 'con', 'com', 'pro', 'pre', 'su', 'sub', 'dis', 'ex', 'im', 'in',
  'en', 'a', 'per', 'entre', 'inter', 'contra', 'sobre', 'super', 'tras', 'ante', 'pos', 'pres', 'circun', 'de'];

/** Stressed -iar/-uar verbs: envío, continúo. */
const STRESSED_IU = new Set(['enviar', 'esquiar', 'confiar', 'enfriar', 'vaciar', 'guiar', 'criar', 'fiar', 'resfriar',
  'continuar', 'actuar', 'graduar', 'evaluar', 'situar']);

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function isInfinitive(w: string) {
  return /^[a-záéíóúñü]*(ar|er|ir|ír)(se)?$/i.test(w.split(' ')[0]);
}

interface Parsed { base: string; reflexive: boolean; tail: string }
function parse(verb: string): Parsed {
  const [head, ...rest] = verb.trim().split(/\s+/);
  const lower = head.toLowerCase();
  const reflexive = /(ar|er|ir|ír)se$/.test(lower);
  return { base: reflexive ? lower.slice(0, -2) : lower, reflexive, tail: rest.length ? ' ' + rest.join(' ') : '' };
}

/** Prefix + root, when `base` is a compound of a known irregular/stem-changing root. */
function compound(base: string): { prefix: string; root: string } | null {
  for (const root of COMPOUND_ROOTS) {
    if (base.length <= root.length || !base.endsWith(root)) continue;
    const prefix = base.slice(0, -root.length);
    if (PREFIXES.includes(prefix)) return { prefix, root };
  }
  return null;
}

/** Change the last occurrence of `from` in the stem. */
function changeLast(stem: string, from: string, to: string): string {
  const i = stem.lastIndexOf(from);
  return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + from.length);
}

function stemChanged(stem: string, kind: 'ie' | 'ue' | 'i', base: string): string {
  if (kind === 'ie') return changeLast(stem, 'e', 'ie');
  if (kind === 'i') return changeLast(stem, 'e', 'i');
  if (base === 'jugar') return changeLast(stem, 'u', 'ue');
  return changeLast(stem, 'o', 'ue');
}

interface Paradigm { pres: string[]; pret: [string, string]; ger: string; part: string }

/** Full paradigm of a (non-reflexive) infinitive. */
function paradigm(base: string): Paradigm {
  const c = IRREGULAR[base] || STEM[base] ? null : compound(base);
  if (c) {
    const r = paradigm(c.root);
    const pre = (s: string) => c.prefix + s;
    return { pres: r.pres.map(pre), pret: [pre(r.pret[0]), pre(r.pret[1])], ger: pre(r.ger), part: pre(r.part) };
  }
  const irr = IRREGULAR[base] ?? {};
  const stem = base.slice(0, -2);
  const end = strip(base.slice(-2)) as 'ar' | 'er' | 'ir';
  const kind = STEM[base];

  // Present
  let pres: string[];
  if (irr.pres) pres = irr.pres;
  else {
    const endings = end === 'ar' ? ['o', 'as', 'a', 'amos', 'an'] : end === 'er' ? ['o', 'es', 'e', 'emos', 'en'] : ['o', 'es', 'e', 'imos', 'en'];
    pres = endings.map((e, p) => {
      let s = stem;
      if (p !== 3) {
        if (kind) s = stemChanged(s, kind, base);
        else if (STRESSED_IU.has(base)) s = s.replace(/([iu])$/, (m) => (m === 'i' ? 'í' : 'ú'));
        else if (end === 'ir' && /[^gq]u$/.test(s)) s += 'y'; // construir → construyo
      }
      if (p === 0) {
        if (end !== 'ar' && /g$/.test(s)) s = s.slice(0, -1) + 'j'; // escoger → escojo
        else if (end === 'ir' && /gu$/.test(s)) s = s.slice(0, -1); // seguir → sigo
        else if (end !== 'ar' && /c$/.test(s)) s = s.slice(0, -1) + (/[aeiou]c$/.test(s) ? 'zc' : 'z'); // conocer → conozco, vencer → venzo
      }
      return s + e;
    });
  }

  // Preterite (yo, él)
  let pret: [string, string];
  if (irr.pret) pret = irr.pret;
  else if (end === 'ar') {
    const yo = /c$/.test(stem) ? stem.slice(0, -1) + 'qu' : /g$/.test(stem) ? stem + 'u' : /z$/.test(stem) ? stem.slice(0, -1) + 'c' : /gu$/.test(stem) ? stem.slice(0, -1) + 'ü' : stem;
    pret = [yo + 'é', stem + 'ó'];
  } else if (/duc$/.test(stem)) {
    pret = [stem.slice(0, -1) + 'je', stem.slice(0, -1) + 'jo']; // conducir → conduje
  } else {
    let s3 = stem;
    if (end === 'ir' && kind) s3 = kind === 'ue' ? changeLast(stem, 'o', 'u') : changeLast(stem, 'e', 'i');
    const vowelStem = /[aeiou]$/.test(stem) && !/[gq]u$/.test(stem);
    pret = [stem + 'í', vowelStem ? stem + 'yó' : s3 + 'ió'];
  }

  // Gerund
  let ger: string;
  if (irr.ger) ger = irr.ger;
  else if (end === 'ar') ger = stem + 'ando';
  else if (/[aeiou]$/.test(stem) && !/[gq]u$/.test(stem)) ger = stem + 'yendo';
  else {
    let s = stem;
    if (end === 'ir' && kind) s = kind === 'ue' ? changeLast(stem, 'o', 'u') : changeLast(stem, 'e', 'i');
    ger = s + 'iendo';
  }

  // Participle
  const part = irr.part ?? (end === 'ar' ? stem + 'ado' : /[aeo]$/.test(stem) ? stem + 'ído' : stem + 'ido');
  return { pres, pret, ger, part };
}

const PRON = ['me', 'te', 'se', 'nos', 'se'];

/** Put the stress accent on a gerund before attaching a pronoun: vistiendo → vistiéndo(me). */
const stressGerund = (g: string) => g.replace(/([ae])(ndo)$/, (_, v, n) => (v === 'a' ? 'á' : 'é') + n);
/** Infinitive with a first-person pronoun: vestirse → vestirme. */
const withMe = (base: string) => base + 'me';

/** Conjugate an infinitive in the present (first word only for multi-word verbs like "lavar manos"). */
export function conjugate(verb: string, person: number): string {
  const { base, reflexive, tail } = parse(verb);
  const form = paradigm(base).pres[person];
  return (reflexive ? PRON[person] + ' ' : '') + form + tail;
}

/**
 * Forms for the word-forms popover, in a fixed order:
 * [yo, tú, él, nosotros, ellos, pret yo, pret él, gerund, participle, "voy a …"].
 * Empty strings mark forms that don't make sense for this verb.
 */
export function verbFormsEs(verb: string): string[] {
  const { base, reflexive, tail } = parse(verb);
  const f = paradigm(base);
  const pres = f.pres.map((x, p) => (reflexive ? PRON[p] + ' ' : '') + x + tail);
  if (!reflexive) {
    return [...pres, f.pret[0] + tail, f.pret[1] + tail, f.ger + tail, f.part + tail, 'voy a ' + verb.trim()];
  }
  return [
    ...pres,
    'me ' + f.pret[0] + tail,
    'se ' + f.pret[1] + tail,
    stressGerund(f.ger) + 'me' + tail,
    tail ? '' : f.part, // "sentado", "vestido"; skipped for "lavarse los dientes"
    'voy a ' + withMe(base) + tail,
  ];
}

export function pluralEs(noun: string): string {
  const w = noun.trim();
  if (/[aeiouáéó]$/i.test(w)) return w + 's';
  if (/z$/i.test(w)) return w.slice(0, -1) + 'ces';
  if (/s$/i.test(w) && !/[áéíóú]s$/i.test(w)) return w; // el lunes → los lunes
  // Drop the written accent on the last syllable: camión → camiones, inglés → ingleses
  const unaccented = w.replace(/á(?=[ns]$)/, 'a').replace(/é(?=[ns]$)/, 'e').replace(/í(?=[ns]$)/, 'i').replace(/ó(?=[ns]$)/, 'o').replace(/ú(?=[ns]$)/, 'u');
  return unaccented + 'es';
}

export function adjectiveFormsEs(adj: string): string[] {
  const w = adj.trim();
  if (/o$/.test(w)) { const s = w.slice(0, -1); return [s + 'a', s + 'os', s + 'as', 'muy ' + w, 'más ' + w]; }
  return [pluralEs(w), 'muy ' + w, 'más ' + w];
}

const NO_FORMS = new Set(['yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'ellas', 'me', 'te', 'no', 'sí', 'y', 'o', 'a', 'de', 'en', 'el', 'la', 'los', 'las', 'un', 'una']);

export function formsForEs(word: string, type?: string): string[] {
  const w = word.trim();
  if (!w || NO_FORMS.has(w.toLowerCase())) return [];
  const uniq = (xs: string[]) => [...new Set(xs.filter((x) => x && x.toLowerCase() !== w.toLowerCase()))];
  if (type === 'verb' && isInfinitive(w)) {
    if (w.toLowerCase() === 'gustar') return ['me gusta', 'te gusta', 'le gusta', 'nos gusta', 'les gusta', 'me gustó', 'me gustan'];
    return uniq(verbFormsEs(w));
  }
  if (type === 'noun' || type === 'folder') return w.includes(' ') ? [] : uniq([pluralEs(w)]);
  if (type === 'descriptor') return w.includes(' ') ? [] : uniq(adjectiveFormsEs(w));
  return [];
}

/**
 * Auto-conjugation: if the message ends with a subject pronoun (optionally
 * followed by "no"), conjugate the new infinitive to match.
 */
export function autoConjugate(prev: string[], verb: string): { text: string; dropPrevious: number } | null {
  if (!isInfinitive(verb)) return null;
  let i = prev.length - 1;
  let negated = false;
  if (prev[i]?.toLowerCase() === 'no') { negated = true; i--; }
  const subj = prev[i]?.toLowerCase();
  if (subj === undefined || !(subj in SUBJECTS)) return null;
  const person = SUBJECTS[subj];
  if (verb.toLowerCase() === 'gustar') {
    // "yo gustar" → "me gusta" (the clitic replaces the pronoun)
    const clitic = ['me', 'te', 'le', 'nos', 'les'][person];
    return { text: (negated ? 'no ' : '') + clitic + ' gusta', dropPrevious: negated ? 2 : 1 };
  }
  return { text: conjugate(verb, person), dropPrevious: 0 };
}
