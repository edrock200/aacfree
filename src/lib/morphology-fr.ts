/**
 * French word forms: plurals, adjective agreement and present-tense
 * conjugation (regular -er/-ir/-re + common irregulars), with elision
 * ("je" + "aimer" → "j'aime").
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
  prendre: { pres: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], part: 'pris' },
  apprendre: { pres: ['apprends', 'apprends', 'apprend', 'apprenons', 'apprenez', 'apprennent'], part: 'appris' },
  comprendre: { pres: ['comprends', 'comprends', 'comprend', 'comprenons', 'comprenez', 'comprennent'], part: 'compris' },
  venir: { pres: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], part: 'venu' },
  tenir: { pres: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'], part: 'tenu' },
  voir: { pres: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], part: 'vu' },
  dire: { pres: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], part: 'dit' },
  mettre: { pres: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'], part: 'mis' },
  boire: { pres: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'], part: 'bu' },
  dormir: { pres: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'], part: 'dormi' },
  sortir: { pres: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'], part: 'sorti' },
  partir: { pres: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'], part: 'parti' },
  sentir: { pres: ['sens', 'sens', 'sent', 'sentons', 'sentez', 'sentent'], part: 'senti' },
  courir: { pres: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'], part: 'couru' },
  lire: { pres: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'], part: 'lu' },
  écrire: { pres: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'], part: 'écrit' },
  ouvrir: { pres: ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'], part: 'ouvert' },
  fermer: { pres: ['ferme', 'fermes', 'ferme', 'fermons', 'fermez', 'ferment'], part: 'fermé' },
  manger: { pres: ['mange', 'manges', 'mange', 'mangeons', 'mangez', 'mangent'], part: 'mangé' },
  nager: { pres: ['nage', 'nages', 'nage', 'nageons', 'nagez', 'nagent'], part: 'nagé' },
  commencer: { pres: ['commence', 'commences', 'commence', 'commençons', 'commencez', 'commencent'], part: 'commencé' },
  acheter: { pres: ['achète', 'achètes', 'achète', 'achetons', 'achetez', 'achètent'], part: 'acheté' },
  appeler: { pres: ['appelle', 'appelles', 'appelle', 'appelons', 'appelez', 'appellent'], part: 'appelé' },
  essayer: { pres: ['essaie', 'essaies', 'essaie', 'essayons', 'essayez', 'essaient'], part: 'essayé' },
  attendre: { pres: ['attends', 'attends', 'attend', 'attendons', 'attendez', 'attendent'], part: 'attendu' },
  entendre: { pres: ['entends', 'entends', 'entend', 'entendons', 'entendez', 'entendent'], part: 'entendu' },
  descendre: { pres: ['descends', 'descends', 'descend', 'descendons', 'descendez', 'descendent'], part: 'descendu' },
  'connaître': { pres: ['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'], part: 'connu' },
  conduire: { pres: ['conduis', 'conduis', 'conduit', 'conduisons', 'conduisez', 'conduisent'], part: 'conduit' },
  construire: { pres: ['construis', 'construis', 'construit', 'construisons', 'construisez', 'construisent'], part: 'construit' },
  asseoir: { pres: ['assieds', 'assieds', 'assied', 'asseyons', 'asseyez', 'asseyent'], part: 'assis' },
  ennuyer: { pres: ['ennuie', 'ennuies', 'ennuie', 'ennuyons', 'ennuyez', 'ennuient'], part: 'ennuyé' },
  lever: { pres: ['lève', 'lèves', 'lève', 'levons', 'levez', 'lèvent'], part: 'levé' },
  promener: { pres: ['promène', 'promènes', 'promène', 'promenons', 'promenez', 'promènent'], part: 'promené' },
  payer: { pres: ['paie', 'paies', 'paie', 'payons', 'payez', 'paient'], part: 'payé' },
  envoyer: { pres: ['envoie', 'envoies', 'envoie', 'envoyons', 'envoyez', 'envoient'], part: 'envoyé' },
  nettoyer: { pres: ['nettoie', 'nettoies', 'nettoie', 'nettoyons', 'nettoyez', 'nettoient'], part: 'nettoyé' },
  pleuvoir: { pres: ['pleut', 'pleut', 'pleut', 'pleut', 'pleut', 'pleut'], part: 'plu' },
  falloir: { pres: ['faut', 'faut', 'faut', 'faut', 'faut', 'faut'], part: 'fallu' },
};

const vowelStart = (w: string) => /^[aeiouyhàâéèêëîïôûü]/i.test(w);

export function isInfinitiveFr(w: string) {
  const head = w.trim().replace(/^se\s+|^s'/, '').split(' ')[0];
  return /(er|ir|re|oir)$/.test(head) && head.length > 2;
}

export function conjugateFr(verb: string, person: number): string {
  const words = verb.trim().split(' ');
  let reflexive = false;
  if (words[0] === 'se' || words[0].startsWith("s'")) {
    reflexive = true;
    if (words[0] === 'se') words.shift(); else words[0] = words[0].slice(2);
  }
  const [head, ...rest] = words;
  const tail = rest.length ? ' ' + rest.join(' ') : '';
  let form: string;
  const irr = IRR[head];
  if (irr) form = irr.pres[person];
  else if (head.endsWith('er')) form = head.slice(0, -2) + ['e', 'es', 'e', 'ons', 'ez', 'ent'][person];
  else if (head.endsWith('ir')) form = head.slice(0, -2) + ['is', 'is', 'it', 'issons', 'issez', 'issent'][person];
  else if (head.endsWith('re')) form = head.slice(0, -2) + ['s', 's', '', 'ons', 'ez', 'ent'][person];
  else form = head;
  if (reflexive) {
    const pro = ['me', 'te', 'se', 'nous', 'vous', 'se'][person];
    form = (person !== 3 && person !== 4 && vowelStart(form) ? pro[0] + "'" : pro + ' ') + form;
  }
  return form + tail;
}

function participle(head: string) {
  if (IRR[head]?.part) return IRR[head].part!;
  if (head.endsWith('er')) return head.slice(0, -2) + 'é';
  if (head.endsWith('ir')) return head.slice(0, -2) + 'i';
  if (head.endsWith('re')) return head.slice(0, -2) + 'u';
  return head;
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

export function formsForFr(word: string, type?: string): string[] {
  const w = word.trim();
  if (!w || NO_FORMS.has(w.toLowerCase())) return [];
  if (type === 'verb' && isInfinitiveFr(w)) {
    const head = w.split(' ')[0];
    const pres = [0, 1, 2, 3, 4, 5].map((p) => conjugateFr(w, p));
    return [...new Set([...pres, participle(head), 'je vais ' + w])].filter((x) => x !== w);
  }
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
  if (person === 0 && vowelStart(form) && !form.startsWith('m')) return { text: "j'" + form, dropPrevious: 1 };
  return { text: form, dropPrevious: 0 };
}
