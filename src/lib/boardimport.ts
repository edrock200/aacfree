import type { WordType } from '../types';
import { WORD_COLORS } from './colors';

/**
 * "Import a board from a picture": the pure parts (no DOM, no OCR), so they can be unit-tested
 * with typed-array images.
 *
 *  1. `detectGrid` finds the grid of tiles in a screenshot or photo of another AAC app's board.
 *     AAC boards are uniform grids of tiles on a plain background, separated by gaps:
 *       - the background is the colour that fills whole rows/columns of the picture (the gaps);
 *       - row and column "ink" profiles (pixels that are not background) are split into bands
 *         wherever a line is (almost) all background;
 *       - the grid is the longest run of bands with the same size and a regular spacing. A missing
 *         tile row or column shows up as a gap of two or three steps and still counts. Toolbars,
 *         message bars and side panels have a different size or spacing, so they are left out;
 *       - rows-then-columns and columns-then-rows are both tried (a top bar hides the column gaps
 *         over the full height, a side bar hides the row gaps over the full width).
 *  2. `cellRect`, `inkFraction`, `tileColor` and `wordTypeForColor` read each cell.
 *  3. `cleanLabel` turns OCR lines into a word, and `isEmptyCell` decides what is an empty square.
 */

export interface RGBAImage { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export type RGB = [number, number, number];
/** A rectangle in image pixels. */
export interface Rect { x: number; y: number; w: number; h: number }
export interface DetectedGrid {
  /** The grid area, padded by half a gap on each side so equal cells line up with the tiles. */
  area: Rect;
  rows: number;
  cols: number;
  background: RGB;
  /** False when no regular grid was found (the area is then the whole picture). */
  found: boolean;
}

/** How far (largest channel difference) a pixel may be from the background colour and still count as background. */
export const BG_TOLERANCE = 22;

const px = (img: RGBAImage, i: number): RGB => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
const near = (a: RGB, b: RGB, tol: number) =>
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;

/**
 * The background colour: of the most common colours, the one that makes up the most separate
 * "gap lines" (rows or columns where it runs unbroken for at least half the picture): the gaps
 * between tiles cross the whole board, while a toolbar or side panel is one solid block.
 * Falls back to the most common colour along the picture's edges.
 */
export function estimateBackground(img: RGBAImage): RGB {
  const { width: W, height: H } = img;
  const step = Math.max(1, Math.floor(Math.sqrt((W * H) / 40000))); // sample about 40k pixels
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const edge = new Map<number, number>();
  const m = Math.max(1, Math.round(Math.min(W, H) * 0.02));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const [r, g, b] = px(img, y * W + x);
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const e = counts.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      counts.set(k, e);
      if (x < m || y < m || x >= W - m || y >= H - m) edge.set(k, (edge.get(k) ?? 0) + 1);
    }
  }
  const mean = (k: number): RGB => {
    const e = counts.get(k)!;
    return [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)];
  };
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([k]) => k);
  let best: RGB | null = null;
  let bestScore = 0;
  for (const k of top) {
    const c = mean(k);
    /** Number of separate runs of gap lines along one axis. */
    const runs = (lines: number, len: number, at: (line: number, i: number) => number) => {
      let n = 0, prev = false;
      for (let l = 0; l < lines; l++) {
        let longest = 0, cur = 0;
        for (let i = 0; i < len; i++) {
          if (near(px(img, at(l, i)), c, BG_TOLERANCE)) { cur++; if (cur > longest) longest = cur; } else cur = 0;
        }
        const gap = longest >= len * 0.5;
        if (gap && !prev) n++;
        prev = gap;
      }
      return n;
    };
    const score = runs(H, W, (y, x) => y * W + x) + runs(W, H, (x, y) => y * W + x);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best) return best;
  const k = [...edge.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? top[0];
  return k === undefined ? [255, 255, 255] : mean(k);
}

/** 1 where a pixel is background. */
function backgroundMask(img: RGBAImage, bg: RGB): Uint8Array {
  const n = img.width * img.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = near(px(img, i), bg, BG_TOLERANCE) ? 1 : 0;
  return mask;
}

type Seg = [number, number]; // [start, end) in pixels

/** Ink (non-background) fraction of each row (axis 'y') or column (axis 'x') inside a window. */
function profile(mask: Uint8Array, W: number, axis: 'x' | 'y', from: number, to: number, len: number): number[] {
  const out: number[] = [];
  const span = Math.max(1, to - from);
  for (let i = 0; i < len; i++) {
    let ink = 0;
    for (let j = from; j < to; j++) ink += 1 - (axis === 'y' ? mask[i * W + j] : mask[j * W + i]);
    out.push(ink / span);
  }
  return out;
}

/**
 * Runs of lines that carry ink. Lines with only a trace of ink (noise, thin borders), or no more
 * than the quietest line plus a little (a toolbar crossing every column), count as gaps.
 */
function segments(prof: number[]): Seg[] {
  const sorted = [...prof].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const min = sorted[0] ?? 0;
  const thresh = Math.max(0.015, min + (p90 - min) * 0.3);
  const minLen = Math.max(2, Math.round(prof.length * 0.012));
  const segs: Seg[] = [];
  let start = -1;
  for (let i = 0; i <= prof.length; i++) {
    const on = i < prof.length && prof[i] > thresh;
    if (on && start < 0) start = i;
    else if (!on && start >= 0) {
      if (i - start >= minLen) segs.push([start, i]);
      start = -1;
    }
  }
  return segs;
}

interface Run { segs: Seg[]; count: number; pitch: number }

/**
 * The longest run of same-sized segments at a regular spacing. A gap of two or three steps is a
 * missing (empty) row or column inside the grid, so it still belongs to the run.
 */
function regularRun(segs: Seg[]): Run | null {
  if (!segs.length) return null;
  const size = (s: Seg) => s[1] - s[0];
  let best: Run | null = null;
  const better = (a: Run, b: Run | null) => !b || a.segs.length > b.segs.length
    || (a.segs.length === b.segs.length && a.count > b.count)
    || (a.segs.length === b.segs.length && a.count === b.count && size(a.segs[0]) > size(b.segs[0]));
  for (const ref of segs) {
    const s0 = size(ref);
    const members = segs.filter((s) => Math.abs(size(s) - s0) <= s0 * 0.2 + 2);
    if (members.length === 1) {
      const run = { segs: members, count: 1, pitch: s0 };
      if (better(run, best)) best = run;
      continue;
    }
    const diffs = members.slice(1).map((s, i) => s[0] - members[i][0]);
    const min = Math.min(...diffs);
    const near1 = diffs.filter((d) => d <= min * 1.6).sort((a, b) => a - b);
    const pitch = near1[Math.floor(near1.length / 2)];
    let chain: Seg[] = [members[0]];
    let count = 1;
    const flush = () => {
      const run = { segs: chain, count, pitch: chain.length > 1 ? (chain[chain.length - 1][0] - chain[0][0]) / (count - 1) : s0 };
      if (better(run, best)) best = run;
    };
    for (let i = 1; i < members.length; i++) {
      const d = members[i][0] - members[i - 1][0];
      const k = Math.round(d / pitch);
      if (k >= 1 && k <= 3 && Math.abs(d - k * pitch) <= pitch * 0.15 && d > s0) {
        chain.push(members[i]);
        count += k;
      } else {
        flush();
        chain = [members[i]];
        count = 1;
      }
    }
    flush();
  }
  return best;
}

/**
 * Drop bands at either end of a run that carry ink across the other axis's gaps: a toolbar or a
 * side panel the same size as a tile crosses the gaps between tiles, a row of tiles does not.
 */
function trimRun(run: Run, other: Run | null, mask: Uint8Array, W: number, axis: 'x' | 'y'): Run {
  if (!other || other.segs.length < 2) return run;
  const gaps: Seg[] = other.segs.slice(1).map((s, i) => [other.segs[i][1], s[0]]);
  const crossesGaps = (band: Seg) => {
    let ink = 0, n = 0;
    for (const g of gaps) for (let a = band[0]; a < band[1]; a++) for (let b = g[0]; b < g[1]; b++) {
      ink += 1 - mask[axis === 'y' ? a * W + b : b * W + a];
      n++;
    }
    return n > 0 && ink / n > 0.3;
  };
  let segs = run.segs;
  while (segs.length > 1 && crossesGaps(segs[0])) segs = segs.slice(1);
  while (segs.length > 1 && crossesGaps(segs[segs.length - 1])) segs = segs.slice(0, -1);
  if (segs === run.segs) return run;
  const count = segs.length > 1 ? Math.round((segs[segs.length - 1][0] - segs[0][0]) / run.pitch) + 1 : 1;
  return { segs, count, pitch: run.pitch };
}

/**
 * Add rows/columns at the ends of a run that hold something but had no clear band of their own,
 * such as a column of white tiles on a white background (only their outlines and words are ink).
 * A candidate one step further out must be separated by a background gap, carry some ink, and
 * not cross the other axis's gaps (so a toolbar is never taken for a row).
 */
function extendRun(run: Run, other: Run | null, mask: Uint8Array, W: number, H: number, axis: 'x' | 'y'): Run {
  if (!other || other.segs.length < 2 || run.count < 2) return run;
  const dim = axis === 'y' ? H : W;
  const size = Math.round(run.segs.reduce((n, s) => n + s[1] - s[0], 0) / run.segs.length);
  const gap = Math.max(1, Math.round(run.pitch - size));
  const span: Seg = [other.segs[0][0], other.segs[other.segs.length - 1][1]];
  const otherGaps: Seg[] = other.segs.slice(1).map((s, i) => [other.segs[i][1], s[0]]);
  /** Ink fraction of the band [a, b) on this axis, over the other axis's ranges. */
  const ink = (a: number, b: number, ranges: Seg[]) => {
    let n = 0, on = 0;
    for (let i = a; i < b; i++) for (const [s, e] of ranges) for (let j = s; j < e; j++) {
      on += 1 - mask[axis === 'y' ? i * W + j : j * W + i];
      n++;
    }
    return n ? on / n : 0;
  };
  const fits = (a: number, b: number) => a >= 0 && b <= dim
    && ink(a, b, [span]) > 0.02 && ink(a, b, otherGaps) < 0.1;
  const segs = [...run.segs];
  for (let k = 0; k < 3; k++) {
    const end = segs[segs.length - 1][1];
    const a = end + gap, b = end + gap + size;
    if (ink(end, a, [span]) > 0.1 || !fits(a, b)) break;
    segs.push([a, b]);
  }
  for (let k = 0; k < 3; k++) {
    const start = segs[0][0];
    const a = start - gap - size, b = start - gap;
    if (ink(b, start, [span]) > 0.1 || !fits(a, b)) break;
    segs.unshift([a, b]);
  }
  if (segs.length === run.segs.length) return run;
  return { segs, count: Math.round((segs[segs.length - 1][0] - segs[0][0]) / run.pitch) + 1, pitch: run.pitch };
}

interface Axis { from: number; to: number; count: number; gap: number }

function axisOf(run: Run): Axis {
  const first = run.segs[0];
  const last = run.segs[run.segs.length - 1];
  const meanSize = run.segs.reduce((n, s) => n + s[1] - s[0], 0) / run.segs.length;
  const gap = run.count > 1 ? Math.max(0, run.pitch - meanSize) : 0;
  return { from: first[0], to: last[1], count: run.count, gap };
}

/** Find the grid of tiles in a picture of an AAC board. */
export function detectGrid(img: RGBAImage): DetectedGrid {
  const { width: W, height: H } = img;
  const background = estimateBackground(img);
  const mask = backgroundMask(img, background);
  const rowsIn = (x0: number, x1: number) => regularRun(segments(profile(mask, W, 'y', x0, x1, H)));
  const colsIn = (y0: number, y1: number) => regularRun(segments(profile(mask, W, 'x', y0, y1, W)));

  type Found = { r: Axis; c: Axis };
  /**
   * Alternate between the two axes, each time looking only inside the other axis's grid span and
   * dropping end bands that cross the other axis's gaps.
   */
  const attempt = (rowsFirst: boolean): Found | null => {
    let rr: Run | null = null;
    let cr: Run | null = null;
    let r: Axis | null = null;
    let c: Axis | null = null;
    for (let step = 0; step < 5; step++) {
      const doRows = (step % 2 === 0) === rowsFirst;
      if (doRows) {
        const run = rowsIn(c ? c.from : 0, c ? c.to : W);
        if (!run) return null;
        rr = trimRun(run, cr, mask, W, 'y');
        r = axisOf(rr);
      } else {
        const run = colsIn(r ? r.from : 0, r ? r.to : H);
        if (!run) return null;
        cr = trimRun(run, rr, mask, W, 'x');
        c = axisOf(cr);
      }
    }
    if (!rr || !cr) return null;
    cr = extendRun(cr, rr, mask, W, H, 'x');
    rr = extendRun(rr, cr, mask, W, H, 'y');
    return { r: axisOf(rr), c: axisOf(cr) };
  };
  const results = [attempt(true), attempt(false)].filter((x): x is Found => !!x);
  const pick = results.sort((a, b) => b.r.count * b.c.count - a.r.count * a.c.count)[0];
  if (!pick || pick.r.count * pick.c.count < 2) {
    return { area: { x: 0, y: 0, w: W, h: H }, rows: 3, cols: 4, background, found: false };
  }
  const { r, c } = pick;
  const x0 = Math.max(0, c.from - c.gap / 2);
  const x1 = Math.min(W, c.to + c.gap / 2);
  const y0 = Math.max(0, r.from - r.gap / 2);
  const y1 = Math.min(H, r.to + r.gap / 2);
  return {
    area: { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) },
    rows: r.count, cols: c.count, background, found: true,
  };
}

/** The rectangle of one cell (row r, column c), shrunk by `inset` (a fraction of the cell) on every side. */
export function cellRect(area: Rect, rows: number, cols: number, r: number, c: number, inset = 0): Rect {
  const cw = area.w / cols;
  const ch = area.h / rows;
  return { x: area.x + c * cw + cw * inset, y: area.y + r * ch + ch * inset, w: cw * (1 - 2 * inset), h: ch * (1 - 2 * inset) };
}

function clampRect(img: RGBAImage, rect: Rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(img.height, Math.ceil(rect.y + rect.h));
  return { x0, y0, x1, y1 };
}

/**
 * The tile inside a cell: the box of rows and columns that are mostly not background. Lets each
 * cell be read from its own tile even when the grid lines are a little off. Null when there is no tile.
 */
export function tileBounds(img: RGBAImage, rect: Rect, bg: RGB): Rect | null {
  const { x0, y0, x1, y1 } = clampRect(img, rect);
  const w = x1 - x0, h = y1 - y0;
  if (w < 4 || h < 4) return null;
  const rows = new Array<number>(h).fill(0);
  const cols = new Array<number>(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (near(px(img, y * img.width + x), bg, BG_TOLERANCE)) continue;
      rows[y - y0]++;
      cols[x - x0]++;
    }
  }
  /** Longest run of lines that are mostly tile (a neighbour's edge peeking in is a separate, shorter run). */
  const longest = (a: number[], len: number): [number, number] | null => {
    let best: [number, number] | null = null;
    let start = -1;
    for (let i = 0; i <= a.length; i++) {
      const on = i < a.length && a[i] > len * 0.3;
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        if (!best || i - start > best[1] - best[0]) best = [start, i];
        start = -1;
      }
    }
    return best;
  };
  const ry = longest(rows, w), rx = longest(cols, h);
  if (!ry || !rx || rx[1] - rx[0] < w * 0.3 || ry[1] - ry[0] < h * 0.3) return null;
  return { x: x0 + rx[0], y: y0 + ry[0], w: rx[1] - rx[0], h: ry[1] - ry[0] };
}

/** Fraction of a rectangle's pixels that are not background (0 for an empty square). */
export function inkFraction(img: RGBAImage, rect: Rect, bg: RGB): number {
  const { x0, y0, x1, y1 } = clampRect(img, rect);
  let ink = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      n++;
      if (!near(px(img, y * img.width + x), bg, BG_TOLERANCE)) ink++;
    }
  }
  return n ? ink / n : 0;
}

/**
 * The tile's own colour, read from the middle of the cell: background, white or near-white
 * (picture areas) and dark pixels (text, outlines) are ignored. Null when the tile has no clear colour.
 */
export function tileColor(img: RGBAImage, rect: Rect, bg: RGB): RGB | null {
  const { x0, y0, x1, y1 } = clampRect(img, rect);
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  const bins = new Map<number, number>();
  const keep: RGB[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const c = px(img, y * img.width + x);
      const max = Math.max(...c), min = Math.min(...c);
      if (near(c, bg, BG_TOLERANCE) || max < 70 || (min > 225 && max - min < 30)) continue;
      keep.push(c);
      const k = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
      bins.set(k, (bins.get(k) ?? 0) + 1);
    }
  }
  const topBin = [...bins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topBin) return null;
  const k = topBin[0];
  const centre: RGB = [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8];
  let n = 0;
  const sum = [0, 0, 0];
  for (const c of keep) {
    if (!near(c, centre, 24)) continue;
    n++; sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
  }
  if (n < area * 0.12) return null;
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
}

function hueOf([r, g, b]: RGB): { hue: number; chroma: number; light: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = max - min;
  let hue = 0;
  if (chroma) {
    if (max === r) hue = 60 * (((g - b) / chroma) % 6);
    else if (max === g) hue = 60 * ((b - r) / chroma + 2);
    else hue = 60 * ((r - g) / chroma + 4);
  }
  return { hue: (hue + 360) % 360, chroma, light: (max + min) / 510 };
}

const hexRGB = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Word types with a colour of their own in the Modified Fitzgerald Key (white, grey and folder beige say nothing). */
const COLOURED: WordType[] = ['pronoun', 'verb', 'descriptor', 'noun', 'social', 'question', 'preposition', 'negation'];
/**
 * Hue anchors: Caleb's own light and dark colours (src/lib/colors.ts), plus the strong versions
 * other AAC apps use for the same key (pure blue describes, violet asks, magenta is social).
 */
const ANCHORS: { type: WordType; hue: number }[] = [
  ...COLOURED.flatMap((type) => [WORD_COLORS[type].light, WORD_COLORS[type].dark].map((c) => ({ type, hue: hueOf(hexRGB(c)).hue }))),
  { type: 'descriptor', hue: 228 },
  { type: 'question', hue: 278 },
  { type: 'social', hue: 325 },
];

/**
 * The Modified Fitzgerald Key word type nearest to a tile colour, by hue. Null for white, grey,
 * black or a colour that is not close to any key colour (the caller then uses its default).
 */
export function wordTypeForColor(rgb: RGB | null): WordType | null {
  if (!rgb) return null;
  const { hue, chroma, light } = hueOf(rgb);
  if (chroma < 24 || light < 0.08) return null;
  let best: WordType | null = null;
  let bestDiff = 31;
  for (const a of ANCHORS) {
    const d = Math.min(Math.abs(hue - a.hue), 360 - Math.abs(hue - a.hue));
    if (d < bestDiff) { bestDiff = d; best = a.type; }
  }
  return best;
}

export interface OcrLine { text: string; confidence: number }

/** One-letter words worth keeping, per communication language (anything else alone is OCR noise). */
const ONE_LETTER: Record<string, Set<string>> = {
  en: new Set(['i', 'a']),
  es: new Set(['i', 'a', 'y', 'o', 'e', 'u']),
  fr: new Set(['i', 'a', 'à', 'y']),
  pt: new Set(['i', 'a', 'e', 'o', 'é', 'à']),
};

/** Clean one OCR line: keep letters (with accents), digits, apostrophes and inner hyphens; drop noise. */
export function cleanLine(text: string, lang = 'en'): string {
  const keep1 = ONE_LETTER[lang] ?? ONE_LETTER.en;
  const words = text
    .replace(/[‘’`´]/g, "'")
    .replace(/[^\p{L}\p{M}\d' -]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => {
      if (!w) return false;
      const letters = (w.match(/\p{L}/gu) ?? []).length;
      if (!letters) return /^\d+$/.test(w) && w.length <= 3; // a number ("2"), not a lone symbol
      if (/\d/.test(w)) return false; // letters mixed with digits ("ft1Q2"): noise
      if (w.length === 1) return keep1.has(w.toLowerCase());
      return true;
    });
  return words.map((w) => {
    const lower = w.toLowerCase();
    // "I", "I'm", "I'll" stay upper case.
    if (lower === 'i' || /^i'/.test(lower)) return 'I' + lower.slice(1);
    // ALL CAPS and Title Case become lower case; mixed case ("McDonald's", "iPad") is kept.
    if (w === w.toUpperCase() || w === w[0].toUpperCase() + w.slice(1).toLowerCase()) return lower;
    return w;
  }).join(' ');
}

/** Score above which a read is trusted without a second look: a known word read with 80% confidence, or any word with 95%. */
export const GOOD_LABEL = 95;

/**
 * The word on a tile from OCR lines (in reading order), with a score to compare reads: the most
 * confident line, cleaned. A line that is a known word (`isKnown`, e.g. it has a symbol) gets a
 * bonus over picture noise. Other lines that are about as confident join it in reading order
 * ("thank" + "you" on a narrow tile). `line` is the best line (for where the word sits).
 */
export function labelOf<L extends OcrLine & { box?: Rect }>(lines: L[], lang = 'en', isKnown?: (word: string) => boolean): { text: string; score: number; line: L | null } {
  // One letter is too easy to misread ("o", "a" from a picture) to earn the known-word bonus.
  const knownWord = (text: string) => text.length > 1 && !!isKnown?.(text);
  /** "quiero o" (a picture edge read as a letter): drop one-letter words at the ends when that leaves a known word. */
  const trimStray = (text: string) => {
    if (!isKnown || knownWord(text)) return text;
    const trimmed = text.replace(/^(\S )+/u, '').replace(/( \S)+$/u, '');
    return trimmed !== text && knownWord(trimmed) ? trimmed : text;
  };
  const cleaned = lines.map((l) => ({ l, text: trimStray(cleanLine(l.text, lang)) })).filter((x) => x.text);
  if (!cleaned.length) return { text: '', score: 0, line: null };
  const score = (x: { l: L; text: string }) => x.l.confidence + (knownWord(x.text) ? 15 : 0);
  const best = cleaned.reduce((a, b) => (score(b) > score(a) ? b : a));
  // A known best word only takes known company (a picture read as "KA" stays out of "play"), and
  // only a line of the same size just above or below it (the second line of a wrapped label).
  const bestKnown = knownWord(best.text);
  const wrapped = (b?: Rect) => {
    const a = best.l.box;
    if (!a || !b) return true;
    const gap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
    return Math.abs(a.h - b.h) <= Math.max(a.h, b.h) * 0.35 && gap <= Math.max(a.h, b.h) * 0.8;
  };
  const strong = cleaned.filter((x) => x === best
    || (x.l.confidence >= 80 && x.l.confidence >= best.l.confidence - 12 && (!bestKnown || knownWord(x.text)) && wrapped(x.l.box)));
  const text = strong.length > 1 ? strong.map((x) => x.text).join(' ') : best.text;
  return { text: text.slice(0, 60).trim(), score: score(best), line: best.l };
}

/** The word on a tile from OCR lines (see `labelOf`). */
export function cleanLabel(lines: OcrLine[], lang = 'en', isKnown?: (word: string) => boolean): string {
  return labelOf(lines, lang, isKnown).text;
}

/** Ink below this fraction of a cell is an empty square (background, maybe a faint outline). */
export const EMPTY_INK = 0.04;

/** A cell is empty when no word was read and it is (almost) all background. */
export function isEmptyCell(label: string, ink: number): boolean {
  return !label.trim() && ink < EMPTY_INK;
}

/**
 * Where the picture is in a cell: the larger part above or below the word (`textBox`, in the same
 * coordinates as `cell`), or the whole cell when there is no word.
 */
export function pictureRect(cell: Rect, textBox?: Rect | null): Rect {
  if (!textBox || textBox.h <= 0) return cell;
  const above = textBox.y - cell.y;
  const below = cell.y + cell.h - (textBox.y + textBox.h);
  const r = above >= below
    ? { x: cell.x, y: cell.y, w: cell.w, h: Math.max(1, above) }
    : { x: cell.x, y: textBox.y + textBox.h, w: cell.w, h: Math.max(1, below) };
  // Too thin to hold a picture: use the whole cell.
  return r.h < cell.h * 0.25 ? cell : r;
}
