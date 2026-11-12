import { getLang, pack } from '../i18n';

/**
 * Simple, private, on-device word prediction.
 * Scores = built-in frequency + words on the person's boards + (opt-in) learned words.
 */

/**
 * Splits text into lowercase words, Unicode-aware: "¿Está bien, niño?" → ["está", "bien", "niño"].
 * Keeps inner apostrophes and hyphens ("don't", "aujourd'hui", "peut-être"); curly apostrophes become '.
 * Used for learning words and for next-word prediction, so both agree on what a word is.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.normalize('NFC').toLowerCase().match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? []) {
    const w = m.replace(/’/g, "'").replace(/^['-]+|['-]+$/g, '');
    if (/\p{L}/u.test(w)) out.push(w);
  }
  return out;
}

/** Accent-insensitive key: "más" → "mas", "garçon" → "garcon". */
export const fold = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const bases = new Map<string, Map<string, number>>();
function base(lang: string): Map<string, number> {
  let m = bases.get(lang);
  if (!m) {
    m = new Map();
    pack().words.forEach((w, i) => {
      const k = w.toLowerCase();
      if (!m!.has(k)) m!.set(k, Math.max(1, 1000 - i));
    });
    bases.set(lang, m);
  }
  return m;
}

export interface PredictContext {
  vocabulary: string[];
  lexicon: Record<string, number>;
  history: { text: string }[];
}

export function predict(prefix: string, prev: string | undefined, ctx: PredictContext, n = 6): string[] {
  const p = prefix.toLowerCase();
  const scores = new Map<string, number>();
  const add = (w: string, s: number) => {
    const k = w.toLowerCase();
    if (!k || k === p) return;
    scores.set(k, (scores.get(k) ?? 0) + s);
  };

  if (!p) {
    // Next-word prediction from the person's own sentence history (accents and case don't matter).
    if (prev) {
      const pt = tokenize(prev);
      const pl = pt[pt.length - 1] ?? prev.toLowerCase();
      const fpl = fold(pl);
      for (const h of ctx.history.slice(0, 100)) {
        const ws = tokenize(h.text);
        for (let i = 0; i < ws.length - 1; i++) if (fold(ws[i]) === fpl) add(ws[i + 1], 400);
      }
      const bigrams = pack().bigrams;
      (bigrams[pl] ?? bigrams[fpl] ?? []).forEach((w, i) => add(w, 300 - i * 10));
    }
    pack().starters.forEach((w, i) => add(w, 100 - i));
    return rank(scores, n);
  }

  // Accent-insensitive: "mas" finds "más", "nino" finds "niño".
  const fp = fold(p);
  for (const [w, s] of base(getLang())) if (fold(w).startsWith(fp)) add(w, s);
  for (const w of ctx.vocabulary) if (!w.includes(' ') && fold(w).startsWith(fp)) add(w, 600);
  for (const [w, c] of Object.entries(ctx.lexicon)) if (typeof c === 'number' && fold(w).startsWith(fp)) add(w, 800 + c * 150);
  return rank(scores, n);
}

function rank(scores: Map<string, number>, n: number) {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, n)
    .map(([w]) => (getLang() === 'en' && (w === 'i' || w.startsWith("i'")) ? 'I' + w.slice(1) : w));
}
