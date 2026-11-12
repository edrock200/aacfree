import type { MessageWord } from '../types';

const NO_SPACE_BEFORE = /^[.,!?;:'’)]|^n't$|^'s$/;

/** Joins message words into a natural sentence string for speech / display. */
export function joinWords(words: Pick<MessageWord, 'text'>[]): string {
  let out = '';
  for (const w of words) {
    const t = w.text.trim();
    if (!t) continue;
    if (!out || NO_SPACE_BEFORE.test(t) || out.endsWith(' ')) out += t;
    else out += ' ' + t;
  }
  return out.replace(/\bi\b/g, 'I');
}

/** Capitalises the first letter and ensures terminal punctuation for display. */
export function toSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const cap = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : cap;
}

export function applyCase(text: string, mode: 'as-is' | 'lower' | 'upper'): string {
  if (mode === 'lower') return text === 'I' || text.startsWith('I ') || text.startsWith("I'") ? text : text.toLowerCase();
  if (mode === 'upper') return text.toUpperCase();
  return text;
}
