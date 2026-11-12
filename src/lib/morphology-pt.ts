/**
 * Brazilian Portuguese word forms: plurals, adjective agreement and verb
 * conjugation (present, preterite eu/ele, gerund, participle). "eu" + "gostar" → "gosto de".
 *
 * Verbs are handled in layers, most specific first:
 *  1. irregular verbs (IRR) and their prefixed compounds (manter ← ter,
 *     descobrir ← cobrir, impedir ← pedir…);
 *  2. stem-vowel changes: e → i (visto, sirvo, prefiro), o → u (durmo, cubro),
 *     u → o (sobe, foge);
 *  3. families and spelling rules: -ear (penteio), -uir (inclui, construído),
 *     -air (sai), -oer (dói), -cer → -ço, -ger/-gir → -jo, -guir → -go,
 *     -car/-gar/-çar → -quei/-guei/-cei;
 *  4. regular endings.
 */

// 0 eu, 1 tu, 2 você/ele/ela/a gente, 3 nós, 4 vocês/eles/elas
export const SUBJECTS_PT: Record<string, number> = {
  eu: 0, tu: 1, 'você': 2, ele: 2, ela: 2, 'a gente': 2, isso: 2, 'nós': 3, 'vocês': 4, eles: 4, elas: 4,
};

interface Irr { pres?: string[]; pret?: [string, string]; ger?: string; part?: string }

const IRR: Record<string, Irr> = {
  ser: { pres: ['sou', 'és', 'é', 'somos', 'são'], pret: ['fui', 'foi'] },
  estar: { pres: ['estou', 'estás', 'está', 'estamos', 'estão'], pret: ['estive', 'esteve'] },
  ir: { pres: ['vou', 'vais', 'vai', 'vamos', 'vão'], pret: ['fui', 'foi'] },
  ter: { pres: ['tenho', 'tens', 'tem', 'temos', 'têm'], pret: ['tive', 'teve'] },
  haver: { pres: ['hei', 'hás', 'há', 'havemos', 'hão'], pret: ['houve', 'houve'] },
  querer: { pres: ['quero', 'queres', 'quer', 'queremos', 'querem'], pret: ['quis', 'quis'] },
  poder: { pres: ['posso', 'podes', 'pode', 'podemos', 'podem'], pret: ['pude', 'pôde'] },
  fazer: { pres: ['faço', 'fazes', 'faz', 'fazemos', 'fazem'], pret: ['fiz', 'fez'], part: 'feito' },
  dizer: { pres: ['digo', 'dizes', 'diz', 'dizemos', 'dizem'], pret: ['disse', 'disse'], part: 'dito' },
  trazer: { pres: ['trago', 'trazes', 'traz', 'trazemos', 'trazem'], pret: ['trouxe', 'trouxe'] },
  ver: { pres: ['vejo', 'vês', 'vê', 'vemos', 'veem'], pret: ['vi', 'viu'], part: 'visto' },
  vir: { pres: ['venho', 'vens', 'vem', 'vimos', 'vêm'], pret: ['vim', 'veio'], ger: 'vindo', part: 'vindo' },
  dar: { pres: ['dou', 'dás', 'dá', 'damos', 'dão'], pret: ['dei', 'deu'] },
  saber: { pres: ['sei', 'sabes', 'sabe', 'sabemos', 'sabem'], pret: ['soube', 'soube'] },
  caber: { pres: ['caibo', 'cabes', 'cabe', 'cabemos', 'cabem'], pret: ['coube', 'coube'] },
  pôr: { pres: ['ponho', 'pões', 'põe', 'pomos', 'põem'], pret: ['pus', 'pôs'], ger: 'pondo', part: 'posto' },
  ler: { pres: ['leio', 'lês', 'lê', 'lemos', 'leem'] },
  crer: { pres: ['creio', 'crês', 'crê', 'cremos', 'creem'] },
  rir: { pres: ['rio', 'ris', 'ri', 'rimos', 'riem'] },
  sorrir: { pres: ['sorrio', 'sorris', 'sorri', 'sorrimos', 'sorriem'] },
  ouvir: { pres: ['ouço', 'ouves', 'ouve', 'ouvimos', 'ouvem'] },
  pedir: { pres: ['peço', 'pedes', 'pede', 'pedimos', 'pedem'] },
  medir: { pres: ['meço', 'medes', 'mede', 'medimos', 'medem'] },
  perder: { pres: ['perco', 'perdes', 'perde', 'perdemos', 'perdem'] },
  valer: { pres: ['valho', 'vales', 'vale', 'valemos', 'valem'] },
  fugir: { pres: ['fujo', 'foges', 'foge', 'fugimos', 'fogem'] },
  construir: { pres: ['construo', 'constróis', 'constrói', 'construímos', 'constroem'] },
  destruir: { pres: ['destruo', 'destróis', 'destrói', 'destruímos', 'destroem'] },
  odiar: { pres: ['odeio', 'odeias', 'odeia', 'odiamos', 'odeiam'] },
  ansiar: { pres: ['anseio', 'anseias', 'anseia', 'ansiamos', 'anseiam'] },
  abrir: { part: 'aberto' },
  cobrir: { part: 'coberto' },
  escrever: { part: 'escrito' },
  morrer: { part: 'morto' },
  chover: { pres: ['chove', 'chove', 'chove', 'chove', 'chove'] },
};

/** -ir verbs whose stem e becomes i in "eu" (visto, sirvo, prefiro, sigo). */
const E_TO_I = new Set(['vestir', 'servir', 'repetir', 'seguir', 'preferir', 'sentir', 'mentir', 'conseguir', 'competir',
  'divertir', 'ferir', 'sugerir', 'despir', 'refletir', 'investir', 'digerir', 'advertir', 'convergir']);
/** -ir verbs whose stem o becomes u in "eu" (durmo, cubro, tusso). */
const O_TO_U = new Set(['dormir', 'cobrir', 'tossir', 'engolir']);
/** -ir verbs whose stem u becomes o in tu/ele/eles (sobe, sacode, consome). */
const U_TO_O = new Set(['subir', 'sacudir', 'cuspir', 'consumir', 'sumir', 'acudir', 'entupir', 'bulir']);

const COMPOUND_ROOTS = ['ter', 'vir', 'pôr', 'por', 'fazer', 'dizer', 'ver', 'pedir', 'seguir', 'vestir', 'sentir', 'servir',
  'cobrir', 'dormir', 'trazer'];
const PREFIXES = ['man', 'con', 'ob', 'de', 'des', 're', 'entre', 'sus', 'a', 'com', 'pro', 'su', 'dis', 'ex', 'im', 'in',
  'inter', 'per', 'pre', 'pres', 'res', 'satis', 'contra', 'en', 'es', 'sobre'];

export function isInfinitivePt(w: string) {
  return /^[a-záâãàçéêíóôõú-]*(ar|er|ir|or|ôr)(-se)?$/i.test(w.trim().split(' ')[0]);
}

interface Paradigm { pres: string[]; pret: [string, string]; ger: string; part: string }

function compound(base: string): { prefix: string; root: string } | null {
  for (const root of COMPOUND_ROOTS) {
    if (base.length <= root.length || !base.endsWith(root)) continue;
    const prefix = base.slice(0, -root.length);
    if (!PREFIXES.includes(prefix)) continue;
    // "ver" only after re/pre (rever, prever), never "escrever", "dever"…
    if (root === 'ver' && prefix !== 're' && prefix !== 'pre') continue;
    return { prefix, root: root === 'por' ? 'pôr' : root };
  }
  return null;
}

function paradigm(base: string): Paradigm {
  const c = IRR[base] ? null : compound(base);
  if (c) {
    const r = paradigm(c.root);
    let pres = r.pres;
    // manter: mantenho, manténs, mantém, mantemos, mantêm (same for vir: convém)
    if (c.root === 'ter') pres = ['tenho', 'téns', 'tém', 'temos', 'têm'];
    if (c.root === 'vir') pres = ['venho', 'véns', 'vém', 'vimos', 'vêm'];
    const pre = (s: string) => c.prefix + s;
    return { pres: pres.map(pre), pret: [pre(r.pret[0]), pre(r.pret[1])], ger: pre(r.ger), part: pre(r.part) };
  }
  const irr = IRR[base] ?? {};
  const stem = base.slice(0, -2);
  const end = base.slice(-2) as 'ar' | 'er' | 'ir';

  let pres: string[];
  if (irr.pres) pres = irr.pres;
  else if (end === 'ar' && /e$/.test(stem)) {
    pres = [stem + 'io', stem + 'ias', stem + 'ia', stem + 'amos', stem + 'iam']; // pentear → penteio
  } else if (end === 'ir' && /[^gq]u$/.test(stem)) {
    pres = [stem + 'o', stem + 'is', stem + 'i', stem + 'ímos', stem + 'em']; // incluir → incluo, inclui
  } else if (end === 'ir' && /a$/.test(stem)) {
    pres = [stem + 'io', stem + 'is', stem + 'i', stem + 'ímos', stem + 'em']; // sair → saio, sai
  } else if (end === 'er' && /o$/.test(stem)) {
    pres = [stem + 'o', stem + 'is', stem + 'i', stem + 'emos', stem + 'em'].map((x, p) => (p === 1 || p === 2 ? x.replace(/oi/, 'ói') : x)); // doer → dói
  } else {
    const endings = end === 'ar' ? ['o', 'as', 'a', 'amos', 'am'] : end === 'er' ? ['o', 'es', 'e', 'emos', 'em'] : ['o', 'es', 'e', 'imos', 'em'];
    pres = endings.map((e, p) => {
      let s = stem;
      if (p === 0) {
        if (E_TO_I.has(base)) s = s.replace(/e([^e]*)$/, 'i$1');
        else if (O_TO_U.has(base)) s = s.replace(/o([^o]*)$/, 'u$1');
        if (end !== 'ar') {
          if (/c$/.test(s)) s = s.slice(0, -1) + 'ç'; // conhecer → conheço
          else if (/g$/.test(s)) s = s.slice(0, -1) + 'j'; // proteger → protejo
          else if (/gu$/.test(s)) s = s.slice(0, -1); // seguir → sigo
        }
      } else if (U_TO_O.has(base) && (p === 1 || p === 2 || p === 4)) s = s.replace(/u([^u]*)$/, 'o$1');
      return s + e;
    });
  }

  let pret: [string, string];
  if (irr.pret) pret = irr.pret;
  else if (end === 'ar') {
    const eu = /c$/.test(stem) ? stem.slice(0, -1) + 'qu' : /ç$/.test(stem) ? stem.slice(0, -1) + 'c' : /g$/.test(stem) ? stem + 'u' : stem;
    pret = [eu + 'ei', stem + 'ou'];
  } else if (end === 'er') pret = [/[aeiou]$/.test(stem) ? stem + 'í' : stem + 'i', stem + 'eu']; // doer → doí
  else pret = [/[aeiou]$/.test(stem) && !/[gq]u$/.test(stem) ? stem + 'í' : stem + 'i', stem + 'iu'];

  const ger = irr.ger ?? stem + (end === 'ar' ? 'ando' : end === 'er' ? 'endo' : 'indo');
  const part = irr.part ?? (end === 'ar' ? stem + 'ado' : /[aeiou]$/.test(stem) && !/[gq]u$/.test(stem) ? stem + 'ído' : stem + 'ido');
  return { pres, pret, ger, part };
}

interface Parsed { base: string; reflexive: boolean; tail: string }
function parse(verb: string): Parsed {
  const [head0, ...rest] = verb.trim().split(/\s+/);
  const reflexive = head0.endsWith('-se');
  return { base: (reflexive ? head0.slice(0, -3) : head0).toLowerCase(), reflexive, tail: rest.length ? ' ' + rest.join(' ') : '' };
}
const PRON = ['me', 'te', 'se', 'nos', 'se'];

export function conjugatePt(verb: string, person: number): string {
  const { base, reflexive, tail } = parse(verb);
  const form = paradigm(base).pres[person];
  return (reflexive ? PRON[person] + ' ' : '') + form + tail;
}

/**
 * Forms for the popover, in a fixed order:
 * [eu, tu, você, nós, vocês, pret eu, pret ele, gerund, participle, "vou …"].
 */
export function verbFormsPt(verb: string): string[] {
  const { base, reflexive, tail } = parse(verb);
  const f = paradigm(base);
  const r = (p: number) => (reflexive ? PRON[p] + ' ' : '');
  const pres = f.pres.map((x, p) => r(p) + x + tail);
  // "vou ir" is avoided in careful Brazilian speech: the present already says it.
  const future = base === 'ir' ? '' : 'vou ' + (reflexive ? 'me ' + base : base) + tail;
  return [...pres, r(0) + f.pret[0] + tail, r(2) + f.pret[1] + tail, f.ger + tail, f.part + tail, future];
}

export function pluralPt(noun: string): string {
  const w = noun.trim();
  if (/ão$/i.test(w)) return w.slice(0, -2) + 'ões';
  if (/[aeiouáéíóúâêô]$/i.test(w)) return w + 's';
  if (/m$/i.test(w)) return w.slice(0, -1) + 'ns';
  if (/il$/i.test(w)) return w.slice(0, -2) + 'is';
  if (/[aeo]l$/i.test(w)) return w.slice(0, -1) + 'is';
  if (/ul$/i.test(w)) return w.slice(0, -1) + 'is';
  if (/[rz]$/i.test(w)) return w + 'es';
  return w; // -s words (ônibus, lápis)
}

export function adjectiveFormsPt(adj: string): string[] {
  const w = adj.trim();
  if (/o$/.test(w)) { const s = w.slice(0, -1); return [s + 'a', s + 'os', s + 'as', 'muito ' + w, 'mais ' + w]; }
  return [...new Set([pluralPt(w), 'muito ' + w, 'mais ' + w])].filter((x) => x !== w);
}

const NO_FORMS = new Set(['eu', 'você', 'ele', 'ela', 'nós', 'eles', 'elas', 'mim', 'sim', 'não', 'e', 'ou', 'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'em']);

export function formsForPt(word: string, type?: string): string[] {
  const w = word.trim();
  if (!w || NO_FORMS.has(w.toLowerCase())) return [];
  if (type === 'verb' && isInfinitivePt(w)) {
    if (w.toLowerCase() === 'gostar') return ['gosto de', 'gosta de', 'gostamos de', 'gostam de', 'gostei de', 'gostou de', 'gostando'];
    return [...new Set(verbFormsPt(w))].filter((x) => x && x !== w);
  }
  if (type === 'noun' || type === 'folder') return w.includes(' ') ? [] : [pluralPt(w)].filter((x) => x !== w);
  if (type === 'descriptor') return w.includes(' ') ? [] : adjectiveFormsPt(w);
  return [];
}

/** "eu" + "querer" → "quero"; "eu" + "gostar" → "gosto de". Handles "eu não …". */
export function autoConjugatePt(prev: string[], verb: string): { text: string; dropPrevious: number } | null {
  if (!isInfinitivePt(verb)) return null;
  let i = prev.length - 1;
  if (prev[i]?.toLowerCase() === 'não') i--;
  let subj = prev[i]?.toLowerCase();
  if (subj === 'gente' && prev[i - 1]?.toLowerCase() === 'a') subj = 'a gente';
  if (subj === undefined || !(subj in SUBJECTS_PT)) return null;
  const person = SUBJECTS_PT[subj];
  let form = conjugatePt(verb, person);
  if (verb.toLowerCase() === 'gostar') form += ' de';
  return { text: form, dropPrevious: 0 };
}
