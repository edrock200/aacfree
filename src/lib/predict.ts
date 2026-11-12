import { COMMON_WORDS } from '../data/words';
import { BIGRAMS } from '../data/bigrams';

/**
 * Simple, private, on-device word prediction.
 * Scores = built-in frequency + words on the person's boards + (opt-in) learned words.
 */

const BASE: Map<string, number> = new Map();
COMMON_WORDS.forEach((w, i) => {
  const k = w.toLowerCase();
  if (!BASE.has(k)) BASE.set(k, Math.max(1, 1000 - i));
});

const STARTERS = ['I', 'you', 'can', 'what', 'want', 'my', 'it', 'is', 'the', 'please'];

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
    // Next-word prediction from the person's own sentence history.
    if (prev) {
      const pl = prev.toLowerCase();
      for (const h of ctx.history.slice(0, 100)) {
        const ws = h.text.toLowerCase().match(/[a-z']+/g) ?? [];
        for (let i = 0; i < ws.length - 1; i++) if (ws[i] === pl) add(ws[i + 1], 400);
      }
      (BIGRAMS[pl] ?? []).forEach((w, i) => add(w, 300 - i * 10));
    }
    STARTERS.forEach((w, i) => add(w, 100 - i));
    return rank(scores, n);
  }

  for (const [w, s] of BASE) if (w.startsWith(p)) add(w, s);
  for (const w of ctx.vocabulary) if (w.startsWith(p) && !w.includes(' ')) add(w, 600);
  for (const [w, c] of Object.entries(ctx.lexicon)) if (w.startsWith(p)) add(w, 800 + c * 150);
  return rank(scores, n);
}

function rank(scores: Map<string, number>, n: number) {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, n)
    .map(([w]) => (w === 'i' || w.startsWith("i'") ? 'I' + w.slice(1) : w));
}
