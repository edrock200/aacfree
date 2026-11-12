/**
 * Spanish word forms: plurals, adjective gender/number and verb conjugation
 * (present, preterite, gerund, participle) for regular verbs and the most
 * common irregular ones. Used for the word-forms popover and for automatic
 * conjugation after a subject pronoun ("yo" + "querer" → "quiero").
 */

// Person index: 0 yo, 1 tú, 2 él/ella/usted, 3 nosotros, 4 ellos/ustedes
export const SUBJECTS: Record<string, number> = {
  yo: 0, 'tú': 1, tu: 1, 'él': 2, ella: 2, usted: 2, eso: 2, esto: 2, nosotros: 3, nosotras: 3,
  ellos: 4, ellas: 4, ustedes: 4,
};

/** Present tense (5 persons), preterite (yo, él), gerund, participle. */
const IRREGULAR: Record<string, { pres?: string[]; pret?: [string, string]; ger?: string; part?: string }> = {
  ser: { pres: ['soy', 'eres', 'es', 'somos', 'son'], pret: ['fui', 'fue'] },
  estar: { pres: ['estoy', 'estás', 'está', 'estamos', 'están'], pret: ['estuve', 'estuvo'] },
  ir: { pres: ['voy', 'vas', 'va', 'vamos', 'van'], pret: ['fui', 'fue'], ger: 'yendo' },
  tener: { pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen'], pret: ['tuve', 'tuvo'] },
  querer: { pres: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'], pret: ['quise', 'quiso'] },
  poder: { pres: ['puedo', 'puedes', 'puede', 'podemos', 'pueden'], pret: ['pude', 'pudo'], ger: 'pudiendo' },
  hacer: { pres: ['hago', 'haces', 'hace', 'hacemos', 'hacen'], pret: ['hice', 'hizo'], part: 'hecho' },
  decir: { pres: ['digo', 'dices', 'dice', 'decimos', 'dicen'], pret: ['dije', 'dijo'], ger: 'diciendo', part: 'dicho' },
  venir: { pres: ['vengo', 'vienes', 'viene', 'venimos', 'vienen'], pret: ['vine', 'vino'], ger: 'viniendo' },
  poner: { pres: ['pongo', 'pones', 'pone', 'ponemos', 'ponen'], pret: ['puse', 'puso'], part: 'puesto' },
  salir: { pres: ['salgo', 'sales', 'sale', 'salimos', 'salen'] },
  ver: { pres: ['veo', 'ves', 've', 'vemos', 'ven'], pret: ['vi', 'vio'], part: 'visto' },
  dar: { pres: ['doy', 'das', 'da', 'damos', 'dan'], pret: ['di', 'dio'] },
  saber: { pres: ['sé', 'sabes', 'sabe', 'sabemos', 'saben'], pret: ['supe', 'supo'] },
  jugar: { pres: ['juego', 'juegas', 'juega', 'jugamos', 'juegan'], pret: ['jugué', 'jugó'] },
  dormir: { pres: ['duermo', 'duermes', 'duerme', 'dormimos', 'duermen'], pret: ['dormí', 'durmió'], ger: 'durmiendo' },
  pedir: { pres: ['pido', 'pides', 'pide', 'pedimos', 'piden'], pret: ['pedí', 'pidió'], ger: 'pidiendo' },
  sentir: { pres: ['siento', 'sientes', 'siente', 'sentimos', 'sienten'], pret: ['sentí', 'sintió'], ger: 'sintiendo' },
  oír: { pres: ['oigo', 'oyes', 'oye', 'oímos', 'oyen'], pret: ['oí', 'oyó'], ger: 'oyendo', part: 'oído' },
  traer: { pres: ['traigo', 'traes', 'trae', 'traemos', 'traen'], pret: ['traje', 'trajo'], ger: 'trayendo' },
  conocer: { pres: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocen'] },
  empezar: { pres: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empiezan'], pret: ['empecé', 'empezó'] },
  pensar: { pres: ['pienso', 'piensas', 'piensa', 'pensamos', 'piensan'] },
  volver: { pres: ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'vuelven'], part: 'vuelto' },
  encontrar: { pres: ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encuentran'] },
  contar: { pres: ['cuento', 'cuentas', 'cuenta', 'contamos', 'cuentan'] },
  mostrar: { pres: ['muestro', 'muestras', 'muestra', 'mostramos', 'muestran'] },
  probar: { pres: ['pruebo', 'pruebas', 'prueba', 'probamos', 'prueban'] },
  cerrar: { pres: ['cierro', 'cierras', 'cierra', 'cerramos', 'cierran'] },
  sentar: { pres: ['siento', 'sientas', 'sienta', 'sentamos', 'sientan'] },
  despertar: { pres: ['despierto', 'despiertas', 'despierta', 'despertamos', 'despiertan'] },
  entender: { pres: ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entienden'] },
  perder: { pres: ['pierdo', 'pierdes', 'pierde', 'perdemos', 'pierden'] },
  llover: { pres: ['llueve', 'llueve', 'llueve', 'llueve', 'llueve'] },
  doler: { pres: ['duelo', 'dueles', 'duele', 'dolemos', 'duelen'] },
  morir: { pres: ['muero', 'mueres', 'muere', 'morimos', 'mueren'], pret: ['morí', 'murió'], ger: 'muriendo', part: 'muerto' },
  leer: { pret: ['leí', 'leyó'], ger: 'leyendo', part: 'leído' },
  caer: { pres: ['caigo', 'caes', 'cae', 'caemos', 'caen'], pret: ['caí', 'cayó'], ger: 'cayendo', part: 'caído' },
  escribir: { part: 'escrito' },
  abrir: { part: 'abierto' },
  romper: { part: 'roto' },
  buscar: { pret: ['busqué', 'buscó'] },
  tocar: { pret: ['toqué', 'tocó'] },
  sacar: { pret: ['saqué', 'sacó'] },
  llegar: { pret: ['llegué', 'llegó'] },
  pagar: { pret: ['pagué', 'pagó'] },
  construir: { pres: ['construyo', 'construyes', 'construye', 'construimos', 'construyen'], pret: ['construí', 'construyó'], ger: 'construyendo' },
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function isInfinitive(w: string) {
  return /^[a-záéíóúñü]*(ar|er|ir|ír)(se)?$/i.test(w.split(' ')[0]);
}

/** Conjugate an infinitive (first word only for multi-word verbs like "lavar manos"). */
export function conjugate(verb: string, person: number): string {
  const [head, ...rest] = verb.trim().split(' ');
  const tail = rest.length ? ' ' + rest.join(' ') : '';
  const lower = head.toLowerCase();
  const reflexive = /se$/.test(lower) && lower.length > 4;
  const base = reflexive ? lower.slice(0, -2) : lower;
  const irr = IRREGULAR[base];
  let form: string;
  if (irr?.pres) form = irr.pres[person];
  else {
    const stem = base.slice(0, -2);
    const end = strip(base.slice(-2));
    const table = end === 'ar' ? ['o', 'as', 'a', 'amos', 'an'] : end === 'er' ? ['o', 'es', 'e', 'emos', 'en'] : ['o', 'es', 'e', 'imos', 'en'];
    form = stem + table[person];
  }
  if (reflexive) form = ['me', 'te', 'se', 'nos', 'se'][person] + ' ' + form;
  return form + tail;
}

export function verbFormsEs(verb: string): string[] {
  const [head, ...rest] = verb.trim().split(' ');
  const tail = rest.length ? ' ' + rest.join(' ') : '';
  const base = head.toLowerCase().replace(/se$/, '');
  const irr = IRREGULAR[base] ?? {};
  const stem = base.slice(0, -2);
  const end = strip(base.slice(-2));
  const pres = [0, 1, 2, 3, 4].map((p) => conjugate(head, p) + tail);
  const pret = irr.pret ?? (end === 'ar' ? [stem + 'é', stem + 'ó'] : [stem + 'í', stem + 'ió']);
  const ger = irr.ger ?? stem + (end === 'ar' ? 'ando' : 'iendo');
  const part = irr.part ?? stem + (end === 'ar' ? 'ado' : 'ido');
  return [...pres, pret[0] + tail, pret[1] + tail, ger + tail, part + tail, 'voy a ' + verb];
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
 * Returns { replacePronoun, text } or null.
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
