import { getLang, pack } from '../i18n';
/**
 * Lightweight English morphology for word forms (plurals, verb tenses,
 * comparatives). Forms are offered on demand — never auto-applied.
 */

const IRREGULAR_VERBS: Record<string, [string, string, string, string]> = {
  // base: [3rd person, -ing, past, past participle]
  be: ['is', 'being', 'was', 'been'],
  am: ['is', 'being', 'was', 'been'],
  is: ['is', 'being', 'was', 'been'],
  are: ['are', 'being', 'were', 'been'],
  have: ['has', 'having', 'had', 'had'],
  do: ['does', 'doing', 'did', 'done'],
  go: ['goes', 'going', 'went', 'gone'],
  eat: ['eats', 'eating', 'ate', 'eaten'],
  drink: ['drinks', 'drinking', 'drank', 'drunk'],
  see: ['sees', 'seeing', 'saw', 'seen'],
  get: ['gets', 'getting', 'got', 'gotten'],
  make: ['makes', 'making', 'made', 'made'],
  take: ['takes', 'taking', 'took', 'taken'],
  give: ['gives', 'giving', 'gave', 'given'],
  come: ['comes', 'coming', 'came', 'come'],
  put: ['puts', 'putting', 'put', 'put'],
  run: ['runs', 'running', 'ran', 'run'],
  sit: ['sits', 'sitting', 'sat', 'sat'],
  stand: ['stands', 'standing', 'stood', 'stood'],
  swim: ['swims', 'swimming', 'swam', 'swum'],
  sing: ['sings', 'singing', 'sang', 'sung'],
  sleep: ['sleeps', 'sleeping', 'slept', 'slept'],
  feel: ['feels', 'feeling', 'felt', 'felt'],
  find: ['finds', 'finding', 'found', 'found'],
  tell: ['tells', 'telling', 'told', 'told'],
  say: ['says', 'saying', 'said', 'said'],
  know: ['knows', 'knowing', 'knew', 'known'],
  think: ['thinks', 'thinking', 'thought', 'thought'],
  buy: ['buys', 'buying', 'bought', 'bought'],
  bring: ['brings', 'bringing', 'brought', 'brought'],
  catch: ['catches', 'catching', 'caught', 'caught'],
  throw: ['throws', 'throwing', 'threw', 'thrown'],
  ride: ['rides', 'riding', 'rode', 'ridden'],
  write: ['writes', 'writing', 'wrote', 'written'],
  read: ['reads', 'reading', 'read', 'read'],
  draw: ['draws', 'drawing', 'drew', 'drawn'],
  cut: ['cuts', 'cutting', 'cut', 'cut'],
  hide: ['hides', 'hiding', 'hid', 'hidden'],
  hold: ['holds', 'holding', 'held', 'held'],
  break: ['breaks', 'breaking', 'broke', 'broken'],
  keep: ['keeps', 'keeping', 'kept', 'kept'],
  build: ['builds', 'building', 'built', 'built'],
  fall: ['falls', 'falling', 'fell', 'fallen'],
  hurt: ['hurts', 'hurting', 'hurt', 'hurt'],
  win: ['wins', 'winning', 'won', 'won'],
  lose: ['loses', 'losing', 'lost', 'lost'],
  leave: ['leaves', 'leaving', 'left', 'left'],
  wear: ['wears', 'wearing', 'wore', 'worn'],
  fly: ['flies', 'flying', 'flew', 'flown'],
  begin: ['begins', 'beginning', 'began', 'begun'],
  wake: ['wakes', 'waking', 'woke', 'woken'],
  can: ['can', 'can', 'could', 'could'],
  will: ['will', 'will', 'would', 'would'],
  lie: ['lies', 'lying', 'lay', 'lain'],
  pay: ['pays', 'paying', 'paid', 'paid'],
  meet: ['meets', 'meeting', 'met', 'met'],
  hear: ['hears', 'hearing', 'heard', 'heard'],
  spin: ['spins', 'spinning', 'spun', 'spun'],
  stim: ['stims', 'stimming', 'stimmed', 'stimmed'],
  feed: ['feeds', 'feeding', 'fed', 'fed'],
  bleed: ['bleeds', 'bleeding', 'bled', 'bled'],
  lead: ['leads', 'leading', 'led', 'led'],
  send: ['sends', 'sending', 'sent', 'sent'],
  spend: ['spends', 'spending', 'spent', 'spent'],
  bend: ['bends', 'bending', 'bent', 'bent'],
  lend: ['lends', 'lending', 'lent', 'lent'],
  bite: ['bites', 'biting', 'bit', 'bitten'],
  blow: ['blows', 'blowing', 'blew', 'blown'],
  grow: ['grows', 'growing', 'grew', 'grown'],
  shake: ['shakes', 'shaking', 'shook', 'shaken'],
  steal: ['steals', 'stealing', 'stole', 'stolen'],
  teach: ['teaches', 'teaching', 'taught', 'taught'],
  fight: ['fights', 'fighting', 'fought', 'fought'],
  forget: ['forgets', 'forgetting', 'forgot', 'forgotten'],
  shoot: ['shoots', 'shooting', 'shot', 'shot'],
  shut: ['shuts', 'shutting', 'shut', 'shut'],
  hit: ['hits', 'hitting', 'hit', 'hit'],
  let: ['lets', 'letting', 'let', 'let'],
  set: ['sets', 'setting', 'set', 'set'],
  quit: ['quits', 'quitting', 'quit', 'quit'],
  dig: ['digs', 'digging', 'dug', 'dug'],
  hang: ['hangs', 'hanging', 'hung', 'hung'],
  light: ['lights', 'lighting', 'lit', 'lit'],
  mean: ['means', 'meaning', 'meant', 'meant'],
  ring: ['rings', 'ringing', 'rang', 'rung'],
  rise: ['rises', 'rising', 'rose', 'risen'],
  sink: ['sinks', 'sinking', 'sank', 'sunk'],
  slide: ['slides', 'sliding', 'slid', 'slid'],
  speak: ['speaks', 'speaking', 'spoke', 'spoken'],
  stick: ['sticks', 'sticking', 'stuck', 'stuck'],
  sting: ['stings', 'stinging', 'stung', 'stung'],
  swing: ['swings', 'swinging', 'swung', 'swung'],
  tear: ['tears', 'tearing', 'tore', 'torn'],
  understand: ['understands', 'understanding', 'understood', 'understood'],
  sell: ['sells', 'selling', 'sold', 'sold'],
  sweep: ['sweeps', 'sweeping', 'swept', 'swept'],
  choose: ['chooses', 'choosing', 'chose', 'chosen'],
  drive: ['drives', 'driving', 'drove', 'driven'],
  freeze: ['freezes', 'freezing', 'froze', 'frozen'],
  beat: ['beats', 'beating', 'beat', 'beaten'],
  become: ['becomes', 'becoming', 'became', 'become'],
  show: ['shows', 'showing', 'showed', 'shown'],
  spit: ['spits', 'spitting', 'spat', 'spat'],
  spread: ['spreads', 'spreading', 'spread', 'spread'],
  weep: ['weeps', 'weeping', 'wept', 'wept'],
  kneel: ['kneels', 'kneeling', 'knelt', 'knelt'],
  lay: ['lays', 'laying', 'laid', 'laid'],
  shine: ['shines', 'shining', 'shone', 'shone'],
  swear: ['swears', 'swearing', 'swore', 'sworn'],
  strike: ['strikes', 'striking', 'struck', 'struck'],
  cost: ['costs', 'costing', 'cost', 'cost'],
};

/** Inflected words that sit on verb buttons ("hurts", "was"): forms come from their dictionary form. */
const LEMMAS: Record<string, string> = { did: 'do', does: 'do', hurts: 'hurt', bleeding: 'bleed', finished: 'finish' };
const BE_FORMS = ['be', 'am', 'is', 'are', 'was', 'were', 'being', 'been'];
const MODALS: Record<string, string> = { can: 'could', will: 'would', could: 'can', would: 'will', shall: 'should', may: 'might' };
/** Set expressions on verb buttons that have no forms ("all done", "hide and seek"). */
const FIXED = new Set(['all done', 'hide and seek', 'deep breath', 'no more']);

const IRREGULAR_PLURALS: Record<string, string> = {
  child: 'children', person: 'people', man: 'men', woman: 'women', mouse: 'mice',
  foot: 'feet', tooth: 'teeth', goose: 'geese', sheep: 'sheep', fish: 'fish',
  deer: 'deer', leaf: 'leaves', knife: 'knives', wife: 'wives', life: 'lives',
  wolf: 'wolves', half: 'halves', shelf: 'shelves', potato: 'potatoes', tomato: 'tomatoes',
  hero: 'heroes', ox: 'oxen', cactus: 'cacti', scarf: 'scarves',
};

const IRREGULAR_ADJ: Record<string, [string, string]> = {
  good: ['better', 'best'], bad: ['worse', 'worst'], little: ['less', 'least'],
  many: ['more', 'most'], much: ['more', 'most'], far: ['farther', 'farthest'], fun: ['more fun', 'most fun'],
};

const VOWELS = 'aeiou';
const isConsonant = (c: string) => !!c && !VOWELS.includes(c);

/** Double final consonant for CVC words (run → running), skipping w/x/y. */
function doubles(word: string): boolean {
  // "qu" works as one consonant (quit → quitting, quiz → quizzing).
  const w = word.replace(/qu(?=[aeiou])/g, 'q');
  if (w.length < 3 || w.length > 5) return false;
  // Only one-syllable words (stop → stopping, but open → opening).
  if ((w.match(/[aeiouy]+/g) ?? []).length !== 1) return false;
  const [a, b, c] = w.slice(-3);
  return isConsonant(a) && VOWELS.includes(b) && isConsonant(c) && !'wxy'.includes(c);
}

export function plural(noun: string): string {
  const w = noun.toLowerCase();
  if (IRREGULAR_PLURALS[w]) return matchCase(noun, IRREGULAR_PLURALS[w]);
  if (/(s|x|z|ch|sh)$/.test(w)) return noun + 'es';
  if (/[^aeiou]y$/.test(w)) return noun.slice(0, -1) + 'ies';
  return noun + 's';
}

export function verbForms(verb: string): { s: string; ing: string; ed: string; en: string } {
  const w = verb.toLowerCase();
  const irr = IRREGULAR_VERBS[w];
  if (irr) return { s: irr[0], ing: irr[1], ed: irr[2], en: irr[3] };
  let s: string;
  if (/(s|x|z|ch|sh|o)$/.test(w)) s = w + 'es';
  else if (/[^aeiou]y$/.test(w)) s = w.slice(0, -1) + 'ies';
  else s = w + 's';
  let ing: string;
  if (/ie$/.test(w)) ing = w.slice(0, -2) + 'ying';
  else if (/[^e]e$/.test(w) && w !== 'be' && w !== 'see') ing = w.slice(0, -1) + 'ing';
  else if (doubles(w)) ing = w + w.slice(-1) + 'ing';
  else ing = w + 'ing';
  let ed: string;
  if (/e$/.test(w)) ed = w + 'd';
  else if (/[^aeiou]y$/.test(w)) ed = w.slice(0, -1) + 'ied';
  else if (doubles(w)) ed = w + w.slice(-1) + 'ed';
  else ed = w + 'ed';
  return { s, ing, ed, en: ed };
}

export function comparatives(adj: string): [string, string] {
  const w = adj.toLowerCase();
  if (IRREGULAR_ADJ[w]) return IRREGULAR_ADJ[w];
  if (w.length > 7 || w.includes(' ') || /(ful|ous|ing|ed|ive)$/.test(w)) return [`more ${w}`, `most ${w}`];
  if (/e$/.test(w)) return [w + 'r', w + 'st'];
  if (/[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ier', w.slice(0, -1) + 'iest'];
  if (doubles(w)) return [w + w.slice(-1) + 'er', w + w.slice(-1) + 'est'];
  return [w + 'er', w + 'est'];
}

function matchCase(src: string, out: string) {
  return src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()
    ? out[0].toUpperCase() + out.slice(1)
    : out;
}

const NO_FORMS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'a', 'the', 'and', 'or', 'but', 'not', 'no', 'yes', 'to', 'of', 'in', 'on', 'up', 'at', 'for', 'with']);

const FUNCTION_TYPES = new Set(['pronoun', 'question', 'preposition', 'determiner', 'conjunction', 'negation', 'social']);

/** Returns sensible alternative forms for a word, given its type (in the current language). */
export function formsFor(word: string, type?: string): string[] {
  const f = pack().forms;
  return getLang() !== 'en' && f ? f(word, type) : formsForEn(word, type);
}

function formsForEn(word: string, type?: string): string[] {
  const base = word.trim();
  if (!base || base.includes(' ') && type !== 'verb') return [];
  const lower = base.toLowerCase();
  if (NO_FORMS.has(lower)) return [];
  // Function words have no useful forms ("what" → "whats", "my" → "mies").
  if (type && FUNCTION_TYPES.has(type)) return [];
  const uniq = (xs: string[]) => [...new Set(xs.filter((x) => x && x.toLowerCase() !== lower))];
  if (type === 'verb') {
    if (FIXED.has(lower)) return [];
    if (BE_FORMS.includes(lower)) return uniq([...BE_FORMS.slice(1), 'to be']);
    if (MODALS[lower]) return uniq([MODALS[lower]]);
    // Multi-word verbs: inflect the first word ("wake up" → "woke up").
    const [head0, ...rest] = base.split(' ');
    const tail = rest.length ? ' ' + rest.join(' ') : '';
    const head = LEMMAS[head0.toLowerCase()] ?? head0;
    const f = verbForms(head);
    return uniq([head + tail, f.s + tail, f.ing + tail, f.ed + tail, f.en + tail, 'to ' + head + tail]);
  }
  if (type === 'noun' || type === 'folder') return uniq([plural(base), base + "'s"]);
  if (type === 'descriptor') {
    const [er, est] = comparatives(base);
    return uniq([er, est, /y$/.test(lower) ? lower.slice(0, -1) + 'ily' : lower + 'ly']);
  }
  // Unknown type: offer the common endings.
  return uniq([plural(base), verbForms(base).ing, verbForms(base).ed]);
}

/** Apply a quick grammar ending to a word (used by +s / +ing / +ed buttons). */
export function applyEnding(word: string, ending: 's' | 'ing' | 'ed', type?: string): string {
  const e = pack().ending;
  if (getLang() !== 'en' && e) return e(word, ending);
  if (ending === 's') return type === 'verb' ? verbForms(word).s : plural(word);
  const f = verbForms(word);
  return ending === 'ing' ? f.ing : f.ed;
}
