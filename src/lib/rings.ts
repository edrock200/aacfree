import { useEffect } from 'react';
import type { Settings } from '../types';

/**
 * Scan, dwell and focus rings. Each ring is two-tone: a coloured outer band
 * (contrasting with the page background) and a black + white inner pair, so
 * at least one band reaches 3:1 against any button fill, Fitzgerald or custom.
 * The per-theme values live in app.css (`--scan`, `--focus`); they are listed
 * here too so a unit test can check their contrast and that the CSS matches.
 */
export const RING_THEMES = {
  light: { bg: '#f6f3ee', scan: '#d63a00', focus: '#0b57d0' },
  dark: { bg: '#15171c', scan: '#ff8a3d', focus: '#ffb84d' },
  contrast: { bg: '#000000', scan: '#ff9900', focus: '#00e5ff' },
} as const;

/** Colours a grown-up can pick for the scan / dwell highlight ('' = the theme's own). */
export const HIGHLIGHT_COLORS: { value: string; name: string }[] = [
  { value: '', name: 'Theme colour' },
  { value: '#ff5a1f', name: 'Orange' },
  { value: '#ffd400', name: 'Yellow' },
  { value: '#e6007e', name: 'Pink' },
  { value: '#00b7ff', name: 'Light blue' },
  { value: '#1f4fff', name: 'Blue' },
  { value: '#18a34a', name: 'Green' },
];

const HEX = /^#[0-9a-f]{6}$/i;

function lin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string) {
  const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const ringWidth = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(14, Math.max(2, v))) : 5);

/** Apply the highlight colour / thickness settings as CSS variables on <html>. */
export function useAccessStyles(s: Pick<Settings, 'highlightColor' | 'highlightWidth'>) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ring-w', `${ringWidth(s.highlightWidth)}px`);
    // Only plain hex colours are honoured (stored settings are never trusted).
    if (typeof s.highlightColor === 'string' && HEX.test(s.highlightColor)) root.style.setProperty('--ring-c-user', s.highlightColor);
    else root.style.removeProperty('--ring-c-user');
  }, [s.highlightColor, s.highlightWidth]);
}
