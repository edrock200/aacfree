import { describe, expect, it } from 'vitest';
import {
  cellRect, cleanLabel, cleanLine, detectGrid, labelOf, estimateBackground, inkFraction, isEmptyCell, pictureRect,
  tileBounds, tileColor, wordTypeForColor, type RGB, type RGBAImage,
} from '../boardimport';
import { WORD_COLORS } from '../colors';
import type { WordType } from '../../types';

// ---------- synthetic board pictures ----------

/** Small deterministic PRNG so the noisy pictures are the same on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface BoardSpec {
  W: number; H: number; rows: number; cols: number;
  /** Space around the grid (left/right/bottom) and above it. */
  margin?: number; top?: number; gap?: number; radius?: number;
  bg?: RGB;
  /** A bar above the grid (message bar / toolbar) of this height. */
  toolbar?: number;
  /** A panel on the left running the full height. */
  sidebar?: number;
  /** Cell indexes (row-major) with no tile. */
  missing?: number[];
  noise?: number; salt?: number; seed?: number;
  tile?: (i: number) => RGB;
  /** A 2 px outline round each tile. */
  outline?: RGB;
}

const PALETTE: RGB[] = [[255, 241, 168], [197, 239, 180], [196, 220, 255], [255, 216, 176], [255, 207, 227], [227, 209, 255]];

function makeBoard(s: BoardSpec) {
  const { W, H, rows, cols } = s;
  const margin = s.margin ?? 20, gap = s.gap ?? 10, radius = s.radius ?? 8;
  const bg = s.bg ?? [246, 243, 238];
  const data = new Uint8ClampedArray(W * H * 4);
  const set = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  };
  const fill = (x0: number, y0: number, w: number, h: number, c: RGB, r = 0) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      // Rounded corners.
      const dx = Math.max(x0 + r - x, x - (x0 + w - 1 - r), 0);
      const dy = Math.max(y0 + r - y, y - (y0 + h - 1 - r), 0);
      if (dx * dx + dy * dy > r * r) continue;
      set(x, y, c);
    }
  };
  fill(0, 0, W, H, bg);
  let top = s.top ?? margin;
  let left = margin;
  if (s.toolbar) { fill(0, 0, W, s.toolbar, [60, 70, 90]); fill(12, 8, W / 3, s.toolbar - 16, [255, 255, 255], 4); top += s.toolbar; }
  if (s.sidebar) { fill(0, 0, s.sidebar, H, [70, 70, 80]); left += s.sidebar; }
  const gw = W - left - margin, gh = H - top - margin;
  const tw = Math.floor((gw - gap * (cols - 1)) / cols);
  const th = Math.floor((gh - gap * (rows - 1)) / rows);
  const tiles: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    const x = left + c * (tw + gap), y = top + r * (th + gap);
    tiles.push({ x, y, w: tw, h: th });
    if (s.missing?.includes(i)) continue;
    if (s.outline) {
      fill(x, y, tw, th, s.outline, radius);
      fill(x + 2, y + 2, tw - 4, th - 4, s.tile ? s.tile(i) : PALETTE[i % PALETTE.length], Math.max(0, radius - 2));
    } else fill(x, y, tw, th, s.tile ? s.tile(i) : PALETTE[i % PALETTE.length], radius);
    // A picture (white square with a dark shape) and a label (dark bar) on each tile.
    const pw = Math.round(tw * 0.5), ph = Math.round(th * 0.45);
    fill(x + Math.round((tw - pw) / 2), y + Math.round(th * 0.12), pw, ph, [255, 255, 255], 3);
    fill(x + Math.round(tw * 0.35), y + Math.round(th * 0.2), Math.round(tw * 0.3), Math.round(th * 0.25), [40, 40, 40]);
    fill(x + Math.round(tw * 0.25), y + Math.round(th * 0.7), Math.round(tw * 0.5), Math.max(2, Math.round(th * 0.1)), [20, 20, 20]);
  }
  if (s.noise || s.salt) {
    const rand = rng(s.seed ?? 1);
    for (let i = 0; i < W * H; i++) {
      if (s.salt && rand() < s.salt) { const v = rand() < 0.5 ? 0 : 255; data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; continue; }
      if (s.noise) for (let k = 0; k < 3; k++) data[i * 4 + k] += Math.round((rand() - 0.5) * 2 * s.noise);
    }
  }
  return { img: { width: W, height: H, data } as RGBAImage, tiles, bg };
}

/** Every detected cell's centre lies inside its tile. */
function centresInTiles(img: ReturnType<typeof makeBoard>, rows: number, cols: number) {
  const g = detectGrid(img.img);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = cellRect(g.area, g.rows, g.cols, r, c);
    const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2;
    const t = img.tiles[r * cols + c];
    if (cx < t.x || cx > t.x + t.w || cy < t.y || cy > t.y + t.h) return false;
  }
  return true;
}

describe('grid detection', () => {
  const cases: [string, BoardSpec][] = [
    ['4 × 3 big buttons', { W: 640, H: 480, rows: 3, cols: 4 }],
    ['8 × 6 full core', { W: 900, H: 640, rows: 6, cols: 8, gap: 6 }],
    ['6 × 5 with wide gaps', { W: 720, H: 600, rows: 5, cols: 6, gap: 18, radius: 14 }],
    ['5 × 6 phone portrait', { W: 400, H: 760, rows: 6, cols: 5, gap: 6, margin: 8 }],
    ['1 row of 6', { W: 700, H: 160, rows: 1, cols: 6 }],
    ['12 × 7 dense', { W: 1000, H: 620, rows: 7, cols: 12, gap: 4, radius: 4, margin: 10 }],
  ];
  for (const [name, spec] of cases) {
    it(`finds ${name}`, () => {
      const b = makeBoard(spec);
      const g = detectGrid(b.img);
      expect(g.found).toBe(true);
      expect([g.rows, g.cols]).toEqual([spec.rows, spec.cols]);
      expect(centresInTiles(b, spec.rows, spec.cols)).toBe(true);
    });
  }

  it('leaves out a toolbar / message bar above the grid', () => {
    const b = makeBoard({ W: 900, H: 700, rows: 5, cols: 6, toolbar: 110, top: 14 });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([5, 6]);
    expect(g.area.y).toBeGreaterThan(105);
    expect(centresInTiles(b, 5, 6)).toBe(true);
  });

  it('leaves out a toolbar as tall as a row of tiles', () => {
    // 600 - 20 (bottom) - 124 (toolbar + space) = 456 for 4 rows of about 106 px; the bar is 110 px.
    const b = makeBoard({ W: 800, H: 600, rows: 4, cols: 5, toolbar: 110, top: 14 });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([4, 5]);
    expect(centresInTiles(b, 4, 5)).toBe(true);
  });

  it('leaves out a side panel running the full height', () => {
    const b = makeBoard({ W: 900, H: 600, rows: 4, cols: 5, sidebar: 140 });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([4, 5]);
    expect(g.area.x).toBeGreaterThan(135);
    expect(centresInTiles(b, 4, 5)).toBe(true);
  });

  it('finds a column of white tiles on a white background (outlined tiles)', () => {
    // The last column's tiles are white like the page; only their outline, picture and word show.
    const b = makeBoard({ W: 900, H: 560, rows: 4, cols: 6, bg: [255, 255, 255], toolbar: 70, outline: [80, 80, 80],
      tile: (i) => (i % 6 === 5 ? [255, 255, 255] : PALETTE[i % PALETTE.length]) });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([4, 6]);
    expect(centresInTiles(b, 4, 6)).toBe(true);
  });

  it('copes with noise', () => {
    const b = makeBoard({ W: 800, H: 600, rows: 5, cols: 6, noise: 8, salt: 0.004, seed: 7 });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([5, 6]);
    expect(centresInTiles(b, 5, 6)).toBe(true);
  });

  it('counts an empty row and empty squares inside the grid', () => {
    // Row 2 (of 0..4) is completely empty and a few squares are missing.
    const missing = [12, 13, 14, 15, 16, 17, 1, 9, 26];
    const b = makeBoard({ W: 760, H: 640, rows: 5, cols: 6, missing });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([5, 6]);
    expect(centresInTiles(b, 5, 6)).toBe(true);
  });

  it('works on a dark background with a toolbar and noise together', () => {
    const b = makeBoard({ W: 960, H: 720, rows: 4, cols: 6, bg: [30, 32, 38], toolbar: 90, noise: 6, seed: 3 });
    const g = detectGrid(b.img);
    expect([g.rows, g.cols]).toEqual([4, 6]);
    expect(centresInTiles(b, 4, 6)).toBe(true);
  });

  it('estimates the background from the gaps, even when tiles cover most of the picture', () => {
    const b = makeBoard({ W: 600, H: 400, rows: 3, cols: 4, margin: 2, gap: 5, bg: [250, 250, 250] });
    const bg = estimateBackground(b.img);
    expect(bg.every((v, i) => Math.abs(v - b.bg[i]) < 6)).toBe(true);
  });

  it('says so when there is no grid', () => {
    const b = makeBoard({ W: 300, H: 200, rows: 1, cols: 1, missing: [0] });
    const g = detectGrid(b.img);
    expect(g.found).toBe(false);
    expect(g.area).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });
});

describe('cell colour → word type', () => {
  const coloured: WordType[] = ['pronoun', 'verb', 'descriptor', 'noun', 'social', 'question', 'preposition', 'negation'];
  const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (const type of coloured) {
    it(`maps Caleb's ${type} colours back to ${type}`, () => {
      expect(wordTypeForColor(rgb(WORD_COLORS[type].light))).toBe(type);
      expect(wordTypeForColor(rgb(WORD_COLORS[type].dark))).toBe(type);
    });
  }
  it('maps the strong colours other AAC apps use', () => {
    expect(wordTypeForColor([255, 255, 0])).toBe('pronoun'); // yellow: people
    expect(wordTypeForColor([60, 200, 60])).toBe('verb'); // green: actions
    expect(wordTypeForColor([0, 90, 255])).toBe('descriptor'); // blue: describing
    expect(wordTypeForColor([255, 140, 0])).toBe('noun'); // orange: things
    expect(wordTypeForColor([255, 105, 180])).toBe('social'); // pink: social
    expect(wordTypeForColor([150, 80, 220])).toBe('question'); // purple: questions
    expect(wordTypeForColor([230, 30, 30])).toBe('negation'); // red: no / not
  });
  it('gives no type for white, grey, black or a colour far from the key', () => {
    expect(wordTypeForColor([255, 255, 255])).toBeNull();
    expect(wordTypeForColor([228, 228, 228])).toBeNull();
    expect(wordTypeForColor([10, 10, 10])).toBeNull();
    expect(wordTypeForColor([0, 200, 200])).toBeNull(); // cyan / teal
    expect(wordTypeForColor(null)).toBeNull();
  });
  it('reads the tile colour, not the white picture or the dark label', () => {
    const b = makeBoard({ W: 400, H: 300, rows: 2, cols: 2, tile: (i) => [[255, 241, 168], [197, 239, 180], [196, 220, 255], [255, 194, 194]][i] as RGB, noise: 5, seed: 2 });
    const g = detectGrid(b.img);
    const types = [0, 1, 2, 3].map((i) => wordTypeForColor(tileColor(b.img, cellRect(g.area, g.rows, g.cols, Math.floor(i / 2), i % 2, 0.1), g.background)));
    expect(types).toEqual(['pronoun', 'verb', 'descriptor', 'negation']);
  });
  it('has no colour for a white tile', () => {
    const b = makeBoard({ W: 300, H: 200, rows: 1, cols: 2, bg: [200, 205, 210], tile: () => [255, 255, 255] });
    const g = detectGrid(b.img);
    expect(tileColor(b.img, cellRect(g.area, 1, 2, 0, 0, 0.1), g.background)).toBeNull();
  });
});

describe('label clean-up', () => {
  it('keeps a plain word in lower case', () => {
    expect(cleanLabel([{ text: 'WANT', confidence: 90 }])).toBe('want');
    expect(cleanLabel([{ text: 'Drink\n', confidence: 90 }])).toBe('drink');
  });
  it('keeps I upper case, and apostrophes', () => {
    expect(cleanLabel([{ text: 'i', confidence: 80 }])).toBe('I');
    expect(cleanLabel([{ text: "I’M", confidence: 80 }])).toBe("I'm");
    expect(cleanLabel([{ text: "don't", confidence: 88 }])).toBe("don't");
    expect(cleanLabel([{ text: 'all done', confidence: 88 }])).toBe('all done');
  });
  it('keeps accents', () => {
    expect(cleanLabel([{ text: 'Café', confidence: 85 }], 'fr')).toBe('café');
    expect(cleanLabel([{ text: 'MAÑANA', confidence: 85 }], 'es')).toBe('mañana');
    expect(cleanLabel([{ text: 'não', confidence: 85 }], 'pt')).toBe('não');
  });
  it('drops stray punctuation and single-letter noise', () => {
    expect(cleanLabel([{ text: '| more .', confidence: 80 }])).toBe('more');
    expect(cleanLabel([{ text: '~ x eat »', confidence: 80 }])).toBe('eat');
    expect(cleanLabel([{ text: 'a', confidence: 80 }])).toBe('a');
    expect(cleanLabel([{ text: '— ©', confidence: 40 }])).toBe('');
    expect(cleanLine('ft1Q2 go')).toBe('go');
  });
  it('keeps one-letter words of the communication language', () => {
    expect(cleanLabel([{ text: 'y', confidence: 80 }], 'es')).toBe('y');
    expect(cleanLabel([{ text: 'y', confidence: 80 }], 'en')).toBe('');
    expect(cleanLabel([{ text: 'à', confidence: 80 }], 'fr')).toBe('à');
  });
  it('keeps mixed-case names', () => {
    expect(cleanLabel([{ text: "McDonald's", confidence: 85 }])).toBe("McDonald's");
    expect(cleanLabel([{ text: 'iPad', confidence: 85 }])).toBe('iPad');
  });
  it('takes the most confident line (picture noise reads as low-confidence lines)', () => {
    expect(cleanLabel([{ text: 'ffr ww', confidence: 31 }, { text: 'help', confidence: 91 }])).toBe('help');
    expect(cleanLabel([{ text: 'help', confidence: 60 }, { text: 'Ww Hh', confidence: 20 }])).toBe('help');
  });
  it('prefers a line that is a known word over confident picture noise', () => {
    const known = (w: string) => ['play', 'ball'].includes(w);
    expect(cleanLabel([{ text: 'KA', confidence: 85 }, { text: 'play', confidence: 80 }], 'en', known)).toBe('play');
    expect(cleanLabel([{ text: 'KA', confidence: 85 }, { text: 'play', confidence: 80 }])).toBe('ka play'); // without word knowledge both confident lines stay
  });
  it('joins two confident lines of a wrapped label', () => {
    expect(cleanLabel([{ text: 'thank', confidence: 92 }, { text: 'you', confidence: 89 }])).toBe('thank you');
  });
  it('only joins a second line of the same size right next to the word', () => {
    const known = () => true;
    const line = (text: string, y: number, h = 30) => ({ text, confidence: 92, box: { x: 10, y, w: 80, h } });
    expect(labelOf([line('thank', 10), line('you', 44)], 'en', known).text).toBe('thank you');
    expect(labelOf([line('agua', 10), line('si', 150)], 'es', known).text).toBe('agua'); // far below: a picture
    expect(labelOf([line('agua', 10), line('si', 44, 12)], 'es', known).text).toBe('agua'); // much smaller
  });
  it('drops a stray letter next to a known word', () => {
    const known = (w: string) => ['quiero', 'a'].includes(w);
    expect(labelOf([{ text: 'quiero o', confidence: 88 }], 'es', known).text).toBe('quiero');
    expect(labelOf([{ text: 'y quiero', confidence: 88 }], 'es', known).text).toBe('quiero');
    expect(labelOf([{ text: 'quiero o', confidence: 88 }], 'es').text).toBe('quiero o'); // no word knowledge: kept
  });
  it('gives a one-letter read no known-word bonus', () => {
    const known = () => true;
    expect(labelOf([{ text: 'o', confidence: 85 }], 'es', known).score).toBe(85);
    expect(labelOf([{ text: 'quiero', confidence: 85 }], 'es', known).score).toBe(100);
  });
  it('keeps short numbers', () => {
    expect(cleanLabel([{ text: '2', confidence: 90 }])).toBe('2');
  });
});

describe('empty squares', () => {
  it('is empty with no word and (almost) no ink', () => {
    expect(isEmptyCell('', 0)).toBe(true);
    expect(isEmptyCell('  ', 0.02)).toBe(true);
    expect(isEmptyCell('', 0.3)).toBe(false); // a tile with a picture but no word read
    expect(isEmptyCell('go', 0)).toBe(false);
  });
  it('measures ink: a missing tile is background, a tile is not', () => {
    const b = makeBoard({ W: 800, H: 300, rows: 1, cols: 4, missing: [1], noise: 6, seed: 9 });
    const g = detectGrid(b.img);
    expect(g.cols).toBe(4);
    const ink = [0, 1, 2, 3].map((c) => inkFraction(b.img, cellRect(g.area, g.rows, g.cols, 0, c, 0.1), g.background));
    expect(ink[0]).toBeGreaterThan(0.5);
    expect(ink[1]).toBeLessThan(0.04);
    expect(ink[2]).toBeGreaterThan(0.5);
    expect(isEmptyCell('', ink[1])).toBe(true);
  });
});

describe('tile bounds', () => {
  it('finds the tile inside a cell, even when the cell is off by a bit', () => {
    const b = makeBoard({ W: 600, H: 400, rows: 2, cols: 3, noise: 5, seed: 4 });
    const g = detectGrid(b.img);
    const cell = cellRect(g.area, g.rows, g.cols, 1, 1, -0.04);
    const shifted = { ...cell, x: cell.x + 6, y: cell.y - 5 };
    const t = tileBounds(b.img, shifted, g.background)!;
    const tile = b.tiles[4];
    expect(Math.abs(t.x - tile.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.y - tile.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.x + t.w - (tile.x + tile.w))).toBeLessThanOrEqual(8); // clipped by the shift at most
  });
  it('is null for an empty square', () => {
    const b = makeBoard({ W: 600, H: 400, rows: 2, cols: 3, missing: [4] });
    const g = detectGrid(b.img);
    expect(tileBounds(b.img, cellRect(g.area, g.rows, g.cols, 1, 1), g.background)).toBeNull();
  });
});

describe('picture area', () => {
  const cell = { x: 0, y: 0, w: 100, h: 100 };
  it('takes the part above a label at the bottom', () => {
    expect(pictureRect(cell, { x: 10, y: 80, w: 80, h: 15 })).toEqual({ x: 0, y: 0, w: 100, h: 80 });
  });
  it('takes the part below a label at the top', () => {
    expect(pictureRect(cell, { x: 10, y: 4, w: 80, h: 14 })).toEqual({ x: 0, y: 18, w: 100, h: 82 });
  });
  it('uses the whole cell without a label', () => {
    expect(pictureRect(cell, null)).toEqual(cell);
  });
});
