import type { AACButton, AppData, Board, Cell, LibraryCategory, LibrarySymbol, Profile, WordType } from '../types';
import { WORD_COLORS } from './colors';

/**
 * Defensive validation for anything that comes from storage, backup files or
 * OBF imports. A bad file must never brick the app or inject markup.
 */

export const MAX_COLS = 20;
export const MAX_ROWS = 30;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const SYMBOL_RE = /^(a:\d{1,7}|e:.{1,16}|img:[\w-]{1,80})$/su;
const WORD_TYPES = new Set(Object.keys(WORD_COLORS));

/** Only plain hex colours are allowed (they end up inside style attributes). */
export const safeColor = (c: unknown): string | undefined => (typeof c === 'string' && COLOR_RE.test(c) ? c : undefined);

export const safeSymbol = (s: unknown): string | undefined => (typeof s === 'string' && SYMBOL_RE.test(s) ? s : undefined);

const str = (v: unknown, max = 500): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export function cleanButton(raw: unknown): AACButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const label = str(b.label, 200);
  if (label === undefined) return null;
  const type = (WORD_TYPES.has(b.type as string) ? b.type : 'misc') as WordType;
  const out: AACButton = { id: str(b.id, 80) || Math.random().toString(36).slice(2), label, type };
  const speak = str(b.speak, 1000); if (speak) out.speak = speak;
  const symbol = safeSymbol(b.symbol); if (symbol) out.symbol = symbol;
  const color = safeColor(b.color); if (color) out.color = color;
  const link = str(b.link, 80); if (link) out.link = link;
  const action = str(b.action, 30); if (action) out.action = action as AACButton['action'];
  const audio = str(b.audio, 80); if (audio && /^[\w-]+$/.test(audio)) out.audio = audio;
  if (b.hidden === true) out.hidden = true;
  if (b.speakOnly === true) out.speakOnly = true;
  const key = str(b.key, 200); if (key) out.key = key;
  if (Array.isArray(b.forms)) out.forms = b.forms.filter((f): f is string => typeof f === 'string').slice(0, 20).map((f) => f.slice(0, 80));
  return out;
}

export function cleanBoard(raw: unknown, id: string): Board | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const cols = int(b.cols, 1, MAX_COLS, 4);
  const cellsIn = Array.isArray(b.cells) ? b.cells : [];
  const rows = int(b.rows, 1, MAX_ROWS, Math.max(1, Math.ceil(cellsIn.length / cols)));
  const cells: Cell[] = Array.from({ length: cols * rows }, (_, i) => cleanButton(cellsIn[i]));
  const key = str(b.key, 100);
  return { id, name: str(b.name, 100) || 'Board', cols, rows, cells, symbol: safeSymbol(b.symbol), ...(key ? { key } : {}) };
}

/** Repairs a profile in place-ish; returns null if it is beyond repair (no usable boards). */
export function repairProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Profile;
  if (!p.boards || typeof p.boards !== 'object') return null;
  const boards: Record<string, Board> = {};
  for (const [id, b] of Object.entries(p.boards)) {
    const cb = cleanBoard(b, id);
    if (cb) boards[id] = cb;
  }
  const ids = Object.keys(boards);
  if (!ids.length) return null;
  // Drop links to boards that no longer exist.
  for (const b of Object.values(boards)) for (const c of b.cells) if (c?.link && !boards[c.link]) delete c.link;
  p.boards = boards;
  if (typeof p.rootId !== 'string' || !boards[p.rootId]) p.rootId = boards.home ? 'home' : ids[0];
  if (typeof p.id !== 'string' || !p.id) p.id = 'p' + Math.random().toString(36).slice(2, 10);
  p.name = str(p.name, 100) ?? '';
  p.quickBar = Array.isArray(p.quickBar) ? p.quickBar.map(cleanButton).filter((x): x is AACButton => !!x).slice(0, 16) : (undefined as never);
  if (!['big', 'compact', 'medium', 'full'].includes(p.layout)) p.layout = 'medium';
  if (p.settings) {
    const langs = ['en', 'es', 'fr', 'pt'];
    if (!langs.includes(p.settings.language)) p.settings.language = 'en';
    if (p.settings.uiLanguage && p.settings.uiLanguage !== 'auto' && !langs.includes(p.settings.uiLanguage)) p.settings.uiLanguage = 'auto';
    if (p.settings.secondLabel && !langs.includes(p.settings.secondLabel)) p.settings.secondLabel = '';
  }
  return p;
}

export function cleanLibrary(raw: unknown): AppData['library'] {
  const lib = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppData['library']>;
  const cleanSym = (s: unknown): LibrarySymbol | null => {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    const symbol = safeSymbol(o.symbol);
    const label = str(o.label, 200);
    if (!symbol || label === undefined) return null;
    return { id: str(o.id, 80) || Math.random().toString(36).slice(2), label, symbol, type: WORD_TYPES.has(o.type as string) ? (o.type as WordType) : undefined };
  };
  const categories: LibraryCategory[] = (Array.isArray(lib.categories) ? lib.categories : []).flatMap((c) => {
    if (!c || typeof c !== 'object') return [];
    const o = c as unknown as Record<string, unknown>;
    return [{
      id: str(o.id, 80) || Math.random().toString(36).slice(2), name: str(o.name, 100) || 'Category',
      icon: safeSymbol(o.icon), symbols: (Array.isArray(o.symbols) ? o.symbols : []).map(cleanSym).filter((x): x is LibrarySymbol => !!x),
    }];
  });
  const additions: Record<string, LibrarySymbol[]> = {};
  if (lib.additions && typeof lib.additions === 'object') {
    for (const [k, v] of Object.entries(lib.additions)) {
      if (Array.isArray(v)) additions[k] = v.map(cleanSym).filter((x): x is LibrarySymbol => !!x);
    }
  }
  return { categories, additions };
}

// ---------- sync stamps (v0.5) ----------
import type { DataSyncInfo, SyncInfo, SyncStamp } from '../types';

const STAMP_KEY_RE = /^(meta|about|qo|po|pco|so|lco|[a-z]{1,3}:.{1,400})$/s;
const DEVICE_RE = /^[\w-]{1,40}$/;
const MAX_STAMPS = 200_000;
/** Stamps far in the future (a device with a wrong clock) are pulled back so they can't win forever. */
const futureLimit = () => Date.now() + 2 * 24 * 3600 * 1000;

function cleanStampMap(raw: unknown): Record<string, SyncStamp> {
  const out: Record<string, SyncStamp> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const limit = futureLimit();
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_STAMPS) break;
    if (!STAMP_KEY_RE.test(k) || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    if (typeof o.t !== 'number' || !Number.isFinite(o.t) || o.t < 0 || typeof o.d !== 'string' || !DEVICE_RE.test(o.d) || o.d === '__proto__') continue;
    out[k] = { t: Math.min(o.t, limit), d: o.d };
    n++;
  }
  return out;
}

/** Validates a profile's or the library's sync stamps. Returns undefined if there are none (they are seeded later). */
export function cleanSyncInfo(raw: unknown): SyncInfo | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const seen: Record<string, number> = {};
  const limit = futureLimit();
  if (o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen)) {
    for (const [d, t] of Object.entries(o.seen as Record<string, unknown>)) {
      if (DEVICE_RE.test(d) && d !== '__proto__' && typeof t === 'number' && Number.isFinite(t) && t >= 0) seen[d] = Math.min(t, limit);
    }
  }
  const out: SyncInfo = { stamps: cleanStampMap(o.stamps), tombstones: cleanStampMap(o.tombstones), seen };
  if (typeof o.lexT === 'number' && Number.isFinite(o.lexT) && o.lexT >= 0) out.lexT = Math.min(o.lexT, limit);
  return out;
}

/** Validates the data-level sync info (deleted profiles). */
export function cleanDataSync(raw: unknown): DataSyncInfo {
  const removed: Record<string, SyncStamp> = {};
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).removed : undefined;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const limit = futureLimit();
    for (const [id, v] of Object.entries(r as Record<string, unknown>)) {
      if (id === '__proto__' || id.length > 80 || !v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      if (typeof o.t === 'number' && Number.isFinite(o.t) && o.t >= 0 && typeof o.d === 'string' && DEVICE_RE.test(o.d)) removed[id] = { t: Math.min(o.t, limit), d: o.d };
    }
  }
  return { removed };
}
