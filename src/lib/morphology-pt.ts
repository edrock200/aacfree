/**
 * Brazilian Portuguese word forms: plurals, adjective agreement and verb
 * conjugation (present, preterite eu/ele, gerund, participle) for regular
 * verbs and common irregulars. "eu" + "gostar" → "gosto de".
 */

// 0 eu, 1 tu, 2 você/ele/ela/a gente, 3 nós, 4 vocês/eles/elas
export const SUBJECTS_PT: Record<string, number> = {
  eu: 0, tu: 1, 'você': 2, ele: 2, ela: 2, 'a gente': 2, isso: 2, 'nós': 3, 'vocês': 4, eles: 4, elas: 4,
};

const IRR: Record<string, { pres?: string[]; pret?: [string, string]; ger?: string; part?: string }> = {
  ser: { pres: ['sou', 'és', 'é', 'somos', 'são'], pret: ['fui', 'foi'] },
  estar: { pres: ['estou', 'estás', 'está', 'estamos', 'estão'], pret: ['estive', 'esteve'] },
  ir: { pres: ['vou', 'vais', 'vai', 'vamos', 'vão'], pret: ['fui', 'foi'] },
  ter: { pres: ['tenho', 'tens', 'tem', 'temos', 'têm'], pret: ['tive', 'teve'] },
  querer: { pres: ['quero', 'queres', 'quer', 'queremos', 'querem'], pret: ['quis', 'quis'] },
  poder: { pres: ['posso', 'podes', 'pode', 'podemos', 'podem'], pret: ['pude', 'pôde'] },
  fazer: { pres: ['faço', 'fazes', 'faz', 'fazemos', 'fazem'], pret: ['fiz', 'fez'], part: 'feito' },
  dizer: { pres: ['digo', 'dizes', 'diz', 'dizemos', 'dizem'], pret: ['disse', 'disse'], part: 'dito' },
  ver: { pres: ['vejo', 'vês', 'vê', 'vemos', 'veem'], pret: ['vi', 'viu'], part: 'visto' },
  vir: { pres: ['venho', 'vens', 'vem', 'vimos', 'vêm'], pret: ['vim', 'veio'], ger: 'vindo', part: 'vindo' },
  dar: { pres: ['dou', 'dás', 'dá', 'damos', 'dão'], pret: ['dei', 'deu'] },
  saber: { pres: ['sei', 'sabes', 'sabe', 'sabemos', 'sabem'], pret: ['soube', 'soube'] },
  pôr: { pres: ['ponho', 'pões', 'põe', 'pomos', 'põem'], pret: ['pus', 'pôs'], ger: 'pondo', part: 'posto' },
  trazer: { pres: ['trago', 'trazes', 'traz', 'trazemos', 'trazem'], pret: ['trouxe', 'trouxe'] },
  ouvir: { pres: ['ouço', 'ouves', 'ouve', 'ouvimos', 'ouvem'] },
  pedir: { pres: ['peço', 'pedes', 'pede', 'pedimos', 'pedem'] },
  dormir: { pres: ['durmo', 'dormes', 'dorme', 'dormimos', 'dormem'] },
  sentir: { pres: ['sinto', 'sentes', 'sente', 'sentimos', 'sentem'] },
  subir: { pres: ['subo', 'sobes', 'sobe', 'subimos', 'sobem'] },
  vestir: { pres: ['visto', 'vestes', 'veste', 'vestimos', 'vestem'] },
  servir: { pres: ['sirvo', 'serves', 'serve', 'servimos', 'servem'] },
  repetir: { pres: ['repito', 'repetes', 'repete', 'repetimos', 'repetem'] },
  seguir: { pres: ['sigo', 'segues', 'segue', 'seguimos', 'seguem'] },
  preferir: { pres: ['prefiro', 'preferes', 'prefere', 'preferimos', 'preferem'] },
  conseguir: { pres: ['consigo', 'consegues', 'consegue', 'conseguimos', 'conseguem'] },
  descobrir: { pres: ['descubro', 'descobres', 'descobre', 'descobrimos', 'descobrem'] },
  tossir: { pres: ['tusso', 'tosses', 'tosse', 'tossimos', 'tossem'] },
  sair: { pres: ['saio', 'sais', 'sai', 'saímos', 'saem'], pret: ['saí', 'saiu'], ger: 'saindo', part: 'saído' },
  cair: { pres: ['caio', 'cais', 'cai', 'caímos', 'caem'], pret: ['caí', 'caiu'], ger: 'caindo', part: 'caído' },
  ler: { pres: ['leio', 'lês', 'lê', 'lemos', 'leem'] },
  perder: { pres: ['perco', 'perdes', 'perde', 'perdemos', 'perdem'] },
  doer: { pres: ['doo', 'dóis', 'dói', 'doemos', 'doem'] },
  abrir: { part: 'aberto' },
  escrever: { part: 'escrito' },
  ficar: { pret: ['fiquei', 'ficou'] },
  brincar: { pret: ['brinquei', 'brincou'] },
  pegar: { pret: ['peguei', 'pegou'] },
  chegar: { pret: ['cheguei', 'chegou'] },
  começar: { pret: ['comecei', 'começou'] },
};

export function isInfinitivePt(w: string) {
  return /^[a-záâãàçéêíóôõú-]*(ar|er|ir|or)(-se)?$/i.test(w.trim().split(' ')[0]);
}

export function conjugatePt(verb: string, person: number): string {
  const [head0, ...rest] = verb.trim().split(' ');
  const reflexive = head0.endsWith('-se');
  const head = reflexive ? head0.slice(0, -3) : head0;
  const tail = rest.length ? ' ' + rest.join(' ') : '';
  const irr = IRR[head];
  let form: string;
  if (irr?.pres) form = irr.pres[person];
  else {
    const stem = head.slice(0, -2);
    const end = head.slice(-2);
    const t = end === 'ar' ? ['o', 'as', 'a', 'amos', 'am'] : end === 'er' ? ['o', 'es', 'e', 'emos', 'em'] : ['o', 'es', 'e', 'imos', 'em'];
    form = stem + t[person];
  }
  if (reflexive) form = ['me', 'te', 'se', 'nos', 'se'][person] + ' ' + form;
  return form + tail;
}

export function verbFormsPt(verb: string): string[] {
  const [head, ...rest] = verb.trim().split(' ');
  const tail = rest.length ? ' ' + rest.join(' ') : '';
  const base = head.replace(/-se$/, '');
  const irr = IRR[base] ?? {};
  const stem = base.slice(0, -2);
  const end = base.slice(-2);
  const pres = [0, 1, 2, 3, 4].map((p) => conjugatePt(verb, p));
  const pret = irr.pret ?? (end === 'ar' ? [stem + 'ei', stem + 'ou'] : end === 'er' ? [stem + 'i', stem + 'eu'] : [stem + 'i', stem + 'iu']);
  const ger = irr.ger ?? stem + (end === 'ar' ? 'ando' : end === 'er' ? 'endo' : 'indo');
  const part = irr.part ?? stem + (end === 'ar' ? 'ado' : 'ido');
  return [...pres, pret[0] + tail, pret[1] + tail, ger + tail, part + tail, 'vou ' + verb];
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
    return [...new Set(verbFormsPt(w))].filter((x) => x !== w);
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
