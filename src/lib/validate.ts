import type {
  AACButton, AboutMe, AppData, Board, Cell, HistoryEntry, LibraryCategory, LibrarySymbol, Phrase, Profile, Schedule, ScheduleStep, Settings, WordType,
} from '../types';
import { WORD_COLORS } from './colors';
import { buildProfile, DEFAULT_SETTINGS } from '../data/defaults';
import { cleanLock, DEFAULT_LOCK } from './lock';

/**
 * Defensive validation for anything that comes from storage, backup files,
 * sync files or OBF imports. A bad file must never brick the app or inject
 * markup. `cleanData()` is the single gate: everything it returns has the
 * exact shape the app expects, whatever junk went in.
 */

export const MAX_COLS = 20;
export const MAX_ROWS = 30;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const SYMBOL_RE = /^(a:\d{1,7}|e:.{1,16}|img:[\w-]{1,80})$/su;
const WORD_TYPES = new Set(Object.keys(WORD_COLORS));
const LANGS = ['en', 'es', 'fr', 'pt'] as const;
const LAYOUTS = ['big', 'compact', 'medium', 'full'] as const;
const MAX_PROFILES = 50;
const MAX_BOARDS = 1000;
const MAX_HISTORY = 100;

/** Only plain hex colours are allowed (they end up inside style attributes). */
export const safeColor = (c: unknown): string | undefined => (typeof c === 'string' && COLOR_RE.test(c) ? c : undefined);

export const safeSymbol = (s: unknown): string | undefined => (typeof s === 'string' && SYMBOL_RE.test(s) ? s : undefined);

const str = (v: unknown, max = 500): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const int = (v: unknown, min: number, max: number, dflt: number) => {
  if (typeof v !== 'number' && typeof v !== 'string') return dflt;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const randomId = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10);

/**
 * Keys that must never be used as plain-object property names: assigning
 * `__proto__` changes the prototype, and the others resolve to inherited
 * members (so `boards['constructor']` would look like a real board).
 */
export const isUnsafeKey = (k: string) => k === '__proto__' || k in Object.prototype;

export function cleanButton(raw: unknown): AACButton | null {
  if (!isObj(raw)) return null;
  const b = raw;
  const label = str(b.label, 200);
  if (label === undefined) return null;
  const type = (WORD_TYPES.has(b.type as string) ? b.type : 'misc') as WordType;
  const out: AACButton = { id: str(b.id, 80) || randomId(), label, type };
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
  if (!isObj(raw)) return null;
  const b = raw;
  const cols = int(b.cols, 1, MAX_COLS, 4);
  const cellsIn = Array.isArray(b.cells) ? b.cells : [];
  const rows = int(b.rows, 1, MAX_ROWS, Math.max(1, Math.min(MAX_ROWS, Math.ceil(cellsIn.length / cols))));
  const cells: Cell[] = Array.from({ length: cols * rows }, (_, i) => cleanButton(cellsIn[i]));
  const key = str(b.key, 100);
  const symbol = safeSymbol(b.symbol);
  return { id, name: str(b.name, 100) || 'Board', cols, rows, cells, ...(symbol ? { symbol } : {}), ...(key ? { key } : {}) };
}

// ---------- settings ----------

const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  language: LANGS,
  uiLanguage: ['auto', ...LANGS],
  secondLabel: ['', ...LANGS],
  theme: ['light', 'dark', 'contrast'],
  style: ['playful', 'clean'],
  colorMode: ['fill', 'border', 'none'],
  textCase: ['as-is', 'lower', 'upper'],
  scanMode: ['auto', 'step'],
  scanPattern: ['row-col', 'linear'],
  pointer: ['off', 'dwell', 'head', 'eyes'],
  keyboardLayout: ['qwerty', 'abc', 'azerty'],
  keepRecent: ['on', 'session', 'off'],
};

/** Numeric limits. A little wider than the sliders, but never values that make the app unusable. */
const RANGES: Partial<Record<keyof Settings, [number, number]>> = {
  rate: [0.3, 2.5],
  pitch: [0.3, 2],
  volume: [0.1, 1],
  fontScale: [0.5, 3],
  gap: [0, 40],
  holdMs: [0, 3000],
  debounceMs: [0, 3000],
  scanMs: [300, 10000],
  dwellMs: [200, 6000],
  pointerSensitivity: [1, 10],
  pointerSmoothing: [0, 0.95],
};

/** Settings that no longer exist (dropped on load). The lock moved to AppData.grownUpLock (see lock.ts). */
const REMOVED_SETTINGS = new Set(['autoBackup', 'lock', 'pin']);

function cleanPronunciations(raw: unknown): Record<string, string> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= 500) break;
    if (typeof v !== 'string' || !k.trim() || isUnsafeKey(k)) continue;
    out[k.slice(0, 100)] = v.slice(0, 200);
    n++;
  }
  return out;
}

function cleanCalibration(raw: unknown): number[][] | undefined {
  if (!Array.isArray(raw) || !raw.length || raw.length > 4) return undefined;
  const rows: number[][] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || !r.length || r.length > 16 || !r.every((x) => typeof x === 'number' && Number.isFinite(x))) return undefined;
    rows.push([...r]);
  }
  return rows;
}

/** Plain JSON values only (for settings added later that this version doesn't know). */
function jsonValue(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') return v.slice(0, 2000);
  if (depth > 4) return undefined;
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => jsonValue(x, depth + 1)).filter((x) => x !== undefined);
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v).slice(0, 200)) {
      if (isUnsafeKey(k)) continue;
      const c = jsonValue(x, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/**
 * Every known setting gets the type of its default, numbers are clamped and
 * enums whitelisted. Unknown keys survive only as plain JSON values.
 */
export function cleanSettings(raw: unknown): Settings {
  const src = isObj(raw) ? raw : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (isUnsafeKey(k) || REMOVED_SETTINGS.has(k) || k in DEFAULT_SETTINGS) continue;
    const c = jsonValue(v);
    if (c !== undefined && c !== null) out[k] = c;
  }
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  for (const k of Object.keys(defaults)) {
    const d = defaults[k];
    const v = src[k];
    let val: unknown = d;
    if (typeof d === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) {
        const r = RANGES[k as keyof Settings];
        val = r ? Math.min(r[1], Math.max(r[0], v)) : v;
      }
    } else if (typeof d === 'string') {
      const allowed = ENUMS[k as keyof Settings];
      if (typeof v === 'string' && (allowed ? allowed.includes(v) : true)) val = v.slice(0, 200);
    } else if (typeof d === 'boolean') {
      if (typeof v === 'boolean') val = v;
    } else if (Array.isArray(d)) {
      val = Array.isArray(v) ? jsonValue(v) : structuredClone(d);
    } else if (isObj(d)) {
      val = isObj(v) ? jsonValue(v) : structuredClone(d);
    }
    out[k] = val;
  }
  // Optional settings with no default.
  const voiceURI = str(src.voiceURI, 500); if (voiceURI) out.voiceURI = voiceURI; else delete out.voiceURI;
  const voiceName = str(src.voiceName, 300); if (voiceName) out.voiceName = voiceName; else delete out.voiceName;
  if (typeof src.voiceIndex === 'number' && Number.isInteger(src.voiceIndex) && src.voiceIndex >= 0 && src.voiceIndex < 10000) out.voiceIndex = src.voiceIndex;
  else delete out.voiceIndex;
  const pron = cleanPronunciations(src.pronunciations); if (pron) out.pronunciations = pron; else delete out.pronunciations;
  const cal = cleanCalibration(src.gazeCalibration); if (cal) out.gazeCalibration = cal; else delete out.gazeCalibration;
  return out as unknown as Settings;
}

// ---------- phrases, schedules, history, about me ----------

export function cleanPhrase(raw: unknown): Phrase | null {
  if (!isObj(raw)) return null;
  const text = str(raw.text, 2000);
  if (!text?.trim()) return null;
  const out: Phrase = { id: str(raw.id, 80) || randomId('ph'), text, category: str(raw.category, 100) ?? '' };
  const symbol = safeSymbol(raw.symbol); if (symbol) out.symbol = symbol;
  const audio = str(raw.audio, 80); if (audio && /^[\w-]+$/.test(audio)) out.audio = audio;
  return out;
}

export function cleanScheduleStep(raw: unknown): ScheduleStep | null {
  if (!isObj(raw)) return null;
  const label = str(raw.label, 200);
  if (label === undefined) return null;
  const out: ScheduleStep = { id: str(raw.id, 80) || randomId('st'), label };
  const symbol = safeSymbol(raw.symbol); if (symbol) out.symbol = symbol;
  if (raw.done === true) out.done = true;
  if (typeof raw.minutes === 'number' && Number.isFinite(raw.minutes) && raw.minutes > 0) out.minutes = Math.min(600, raw.minutes);
  // Keep any newer scalar fields (e.g. a clock time) as plain values.
  for (const [k, v] of Object.entries(raw)) {
    if (k in out || isUnsafeKey(k) || ['id', 'label', 'symbol', 'done', 'minutes'].includes(k)) continue;
    if (typeof v === 'string') (out as unknown as Record<string, unknown>)[k] = v.slice(0, 200);
    else if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function cleanSchedule(raw: unknown): Schedule | null {
  if (!isObj(raw)) return null;
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 100).map(cleanScheduleStep).filter((x): x is ScheduleStep => !!x);
  const out: Schedule = { id: str(raw.id, 80) || randomId('s'), name: str(raw.name, 100) ?? '', steps };
  for (const [k, v] of Object.entries(raw)) {
    if (isUnsafeKey(k) || ['id', 'name', 'steps'].includes(k)) continue;
    if (typeof v === 'string') (out as unknown as Record<string, unknown>)[k] = v.slice(0, 200);
    else if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function cleanHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  const seen = new Set<string>();
  for (const h of raw) {
    if (out.length >= MAX_HISTORY) break;
    if (!isObj(h)) continue;
    const text = str(h.text, 2000);
    if (!text?.trim()) continue;
    const t = typeof h.t === 'number' && Number.isFinite(h.t) ? h.t : 0;
    let id = str(h.id, 80) || `h${t.toString(36)}-${out.length}`;
    if (seen.has(id)) id = randomId('h');
    seen.add(id);
    out.push({ id, text, t });
  }
  return out;
}

export function cleanAboutMe(raw: unknown, fallback: AboutMe): AboutMe {
  if (!isObj(raw)) return { ...fallback };
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    text: str(raw.text, 5000) ?? fallback.text,
    contacts: str(raw.contacts, 2000) ?? '',
  };
}

export function cleanLexicon(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= 20000) break;
    if (isUnsafeKey(k) || k.length > 60 || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    out[k] = Math.min(1e9, Math.round(v));
    n++;
  }
  return out;
}

function cleanPhraseCategories(raw: unknown, phrases: Phrase[], fallback: string[]): string[] {
  const cats = Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => c.slice(0, 100))
    : [...fallback];
  // Every phrase must be reachable from a tab.
  for (const p of phrases) if (p.category && !cats.includes(p.category)) cats.push(p.category);
  return [...new Set(cats)].slice(0, 100);
}

// ---------- profiles ----------

/** Board ids that collide with Object.prototype get a safe id; links follow. */
function safeBoardId(id: string, taken: Set<string>): string {
  let next = isUnsafeKey(id) || !id ? `board-${id || 'x'}` : id.slice(0, 80);
  while (taken.has(next) || isUnsafeKey(next)) next = `${next}-${Math.random().toString(36).slice(2, 6)}`;
  return next;
}

/** Repairs a profile; returns null if it is beyond repair (no usable boards). */
export function repairProfile(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  const p = raw as unknown as Profile;
  if (!isObj(p.boards)) return null;
  const boards: Record<string, Board> = {};
  const rename = new Map<string, string>();
  const taken = new Set<string>();
  for (const [id, b] of Object.entries(p.boards as Record<string, unknown>).slice(0, MAX_BOARDS)) {
    const safe = safeBoardId(id, taken);
    const cb = cleanBoard(b, safe);
    if (!cb) continue;
    taken.add(safe);
    rename.set(id, safe);
    boards[safe] = cb;
  }
  const ids = Object.keys(boards);
  if (!ids.length) return null;
  const has = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(boards, id);
  const resolve = (id: unknown) => (typeof id === 'string' && rename.has(id) ? rename.get(id) : undefined);
  // Follow renamed boards; drop links to boards that no longer exist.
  for (const b of Object.values(boards)) {
    for (const c of b.cells) {
      if (!c?.link) continue;
      const to = resolve(c.link);
      if (to) c.link = to; else delete c.link;
    }
  }
  p.boards = boards;
  const root = resolve(p.rootId);
  p.rootId = root && has(root) ? root : has('home') ? 'home' : ids[0];
  if (typeof p.id !== 'string' || !p.id.trim() || p.id.length > 80) p.id = randomId('p');
  p.name = str(p.name, 100) ?? '';
  p.quickBar = Array.isArray(p.quickBar) ? p.quickBar.map(cleanButton).filter((x): x is AACButton => !!x).slice(0, 16) : (undefined as never);
  if (!LAYOUTS.includes(p.layout)) p.layout = 'medium';
  return p;
}

let freshCache: Profile | null = null;
const fresh = () => (freshCache ??= buildProfile('', 'medium'));

/** Fills every field of a repaired profile (settings, phrases, schedules…) with clean values. */
export function cleanProfileContent(p: Profile): Profile {
  const f = fresh();
  const settings = cleanSettings(p.settings);
  const phrases = (Array.isArray(p.phrases) ? p.phrases : structuredClone(f.phrases)).slice(0, 2000).map(cleanPhrase).filter((x): x is Phrase => !!x);
  const out: Profile = {
    ...p,
    settings,
    quickBar: Array.isArray(p.quickBar) ? p.quickBar : structuredClone(f.quickBar),
    phrases,
    phraseCategories: cleanPhraseCategories(p.phraseCategories, phrases, f.phraseCategories),
    schedules: (Array.isArray(p.schedules) ? p.schedules : []).slice(0, 200).map(cleanSchedule).filter((x): x is Schedule => !!x),
    aboutMe: cleanAboutMe(p.aboutMe, f.aboutMe),
    lexicon: cleanLexicon(p.lexicon),
    // Recent sentences are only stored when the person keeps them.
    history: settings.keepRecent === 'on' ? cleanHistory(p.history) : [],
    createdAt: typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
  };
  if (typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt)) out.updatedAt = p.updatedAt; else delete out.updatedAt;
  return out;
}

/**
 * The single gate for untrusted data. Throws only a friendly Error (no
 * profiles, a newer version, no usable boards); otherwise always returns
 * data the app can run on.
 */
export function cleanData(input: unknown, version: number): AppData {
  if (!isObj(input) || !Array.isArray(input.profiles)) throw new Error('This file has no Caleb profiles.');
  const data = input as unknown as AppData;
  if (typeof data.version === 'number' && data.version > version) {
    throw new Error('This file was made by a newer version of Caleb. Please update the app first.');
  }
  const profiles: Profile[] = [];
  const ids = new Set<string>();
  for (const raw of (data.profiles as unknown[]).slice(0, MAX_PROFILES)) {
    const r = repairProfile(raw);
    if (!r) continue;
    const p = cleanProfileContent(r);
    // Two profiles with one id would merge and overwrite each other.
    while (ids.has(p.id)) p.id = randomId('p');
    ids.add(p.id);
    profiles.push(p);
  }
  if (!profiles.length) throw new Error('This file has no usable boards.');
  const active = typeof data.activeProfileId === 'string' && ids.has(data.activeProfileId) ? data.activeProfileId : profiles[0].id;
  return {
    version,
    profiles,
    activeProfileId: active,
    onboarded: data.onboarded !== false,
    library: cleanLibrary(data.library),
    grownUpLock: cleanLock(data.grownUpLock) ?? { ...DEFAULT_LOCK },
  };
}

export function cleanLibrary(raw: unknown): AppData['library'] {
  const lib = (isObj(raw) ? raw : {}) as Partial<AppData['library']>;
  const cleanSym = (s: unknown): LibrarySymbol | null => {
    if (!isObj(s)) return null;
    const o = s;
    const symbol = safeSymbol(o.symbol);
    const label = str(o.label, 200);
    if (!symbol || label === undefined) return null;
    const out: LibrarySymbol = { id: str(o.id, 80) || randomId(), label, symbol };
    if (WORD_TYPES.has(o.type as string)) out.type = o.type as WordType;
    return out;
  };
  const categories: LibraryCategory[] = (Array.isArray(lib.categories) ? lib.categories : []).slice(0, 500).flatMap((c) => {
    if (!isObj(c)) return [];
    const o = c;
    const icon = safeSymbol(o.icon);
    return [{
      id: str(o.id, 80) || randomId(), name: str(o.name, 100) || 'Category',
      ...(icon ? { icon } : {}),
      symbols: (Array.isArray(o.symbols) ? o.symbols : []).slice(0, 5000).map(cleanSym).filter((x): x is LibrarySymbol => !!x),
    }];
  });
  const additions: Record<string, LibrarySymbol[]> = {};
  if (isObj(lib.additions)) {
    for (const [k, v] of Object.entries(lib.additions)) {
      if (isUnsafeKey(k)) continue;
      if (Array.isArray(v)) additions[k] = v.slice(0, 5000).map(cleanSym).filter((x): x is LibrarySymbol => !!x);
    }
  }
  return { categories, additions };
}

// ---------- privacy helpers ----------

/**
 * Data as it may be written to storage, snapshots or files: recent sentences
 * are left out for profiles that keep them for this session only (or not at all).
 */
export function withoutTransient(data: AppData): AppData {
  if (!data.profiles.some((p) => p.settings?.keepRecent && p.settings.keepRecent !== 'on' && p.history?.length)) return data;
  return {
    ...data,
    profiles: data.profiles.map((p) => (p.settings?.keepRecent && p.settings.keepRecent !== 'on' && p.history?.length ? { ...p, history: [] } : p)),
  };
}

/**
 * True when the data is the untouched placeholder (nothing a family made):
 * used so an empty default never replaces a real backup.
 */
export function hasUserContent(data: AppData | undefined | null): boolean {
  try {
    if (!data || !Array.isArray(data.profiles) || !data.profiles.length) return false;
    if (data.profiles.length > 1) return true;
    const p = data.profiles[0] as Partial<Profile> | null;
    if (!p) return false;
    if ((typeof p.name === 'string' && p.name.trim()) || p.updatedAt) return true;
    if ((Array.isArray(p.history) && p.history.length) || (isObj(p.lexicon) && Object.keys(p.lexicon).length)) return true;
    const lib = data.library;
    return !!(isObj(lib) && ((Array.isArray(lib.categories) && lib.categories.length)
      || (isObj(lib.additions) && Object.values(lib.additions).some((a) => Array.isArray(a) && a.length))));
  } catch {
    return true;
  }
}
