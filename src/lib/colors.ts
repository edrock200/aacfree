import type { WordType } from '../types';

/** Modified Fitzgerald Key (with light/dark variants). */
export const WORD_COLORS: Record<WordType, { light: string; dark: string; name: string }> = {
  pronoun: { light: '#fff1a8', dark: '#6b5d12', name: 'People / pronouns' },
  verb: { light: '#c5efb4', dark: '#2f5d22', name: 'Actions / verbs' },
  descriptor: { light: '#c4dcff', dark: '#24477a', name: 'Describing words' },
  noun: { light: '#ffd8b0', dark: '#7a4314', name: 'Things / nouns' },
  social: { light: '#ffcfe3', dark: '#7a2c4f', name: 'Social words' },
  question: { light: '#e3d1ff', dark: '#4d2f7a', name: 'Questions' },
  preposition: { light: '#f9d9f2', dark: '#6b2c5e', name: 'Little position words' },
  negation: { light: '#ffc2c2', dark: '#7a1f1f', name: 'No / not' },
  determiner: { light: '#e4e4e4', dark: '#4a4a4a', name: 'Little words' },
  conjunction: { light: '#ffffff', dark: '#3a3a3a', name: 'Joining words' },
  folder: { light: '#efe3cf', dark: '#55462f', name: 'Folders' },
  misc: { light: '#ffffff', dark: '#33363d', name: 'Other' },
};

export const COLOR_SWATCHES = [
  '#fff1a8', '#c5efb4', '#c4dcff', '#ffd8b0', '#ffcfe3', '#e3d1ff', '#ffc2c2', '#e4e4e4',
  '#ffffff', '#efe3cf', '#b8f0ee', '#ffe0a3',
];

const HEX = /^#[0-9a-f]{3,8}$/i;

export function buttonColor(type: WordType, dark: boolean, override?: string) {
  // Only plain hex colours are honoured (values end up in style attributes / printed HTML).
  if (override && HEX.test(override)) return override;
  const c = WORD_COLORS[type] ?? WORD_COLORS.misc;
  return dark ? c.dark : c.light;
}

/** Pick readable text colour for an arbitrary background. */
export function textOn(bg: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  if (!m) return 'inherit';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1d1d1f' : '#ffffff';
}
