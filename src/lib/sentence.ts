import type { MessageWord } from '../types';
import { getLang } from '../i18n';

const NO_SPACE_BEFORE = /^[.,!?;:'’)]|^n't$|^'s$/;

/** English "i" on its own (not inside a word such as "dói" or "aí"). */
const LONE_I = /(?<![\p{L}\p{N}'’])i(?![\p{L}\p{N}])/gu;

/**
 * Joins message words into a natural sentence string for speech / display.
 * In English a lone "i" becomes "I"; other languages are left as written.
 */
export function joinWords(words: Pick<MessageWord, 'text'>[], lang: string = getLang()): string {
  let out = '';
  for (const w of words) {
    const t = w.text.trim();
    if (!t) continue;
    if (!out || NO_SPACE_BEFORE.test(t) || out.endsWith(' ')) out += t;
    else out += ' ' + t;
  }
  return lang === 'en' ? out.replace(LONE_I, 'I') : out;
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
