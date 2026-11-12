import { cleanDataSync, cleanSyncInfo } from './validate';
import type { AppData, Board, Cell, DataSyncInfo, LibraryCategory, LibrarySymbol, Profile, SymbolLibrary, SyncInfo, SyncStamp } from '../types';

/**
 * Per-item change stamps, the bookkeeping behind merging changes from several
 * devices (see merge.ts).
 *
 * A profile is viewed as a flat map of small "items", each with a stable key:
 *   meta                 name, layout, home board
 *   b:<board>            board details (name, size, symbol…)
 *   c:<board>:<r>:<c>    one button, by row and column (so resizing keeps keys)
 *   q:<id>, qo           quick-bar button, quick-bar order
 *   ph:<id>, po          phrase, phrase order
 *   pc:<name>, pco       phrase category, category order
 *   s:<id>, so           schedule, schedule order
 *   about                About me
 *   set:<field>          one setting (device-only settings are left out)
 *   f:<field>            any other profile field (future-proof)
 * The shared symbol library uses lc:<cat>, ls:<cat>:<sym>, la:<builtIn>:<sym>
 * and the order items lco, lso:<cat>, lao:<cat>.
 *
 * Every local change goes through `stampData(prev, next)` (called by the
 * store): it diffs the two versions and gives each changed item a stamp
 * `{ t, d }` (hybrid clock time, device id), or a tombstone if it was removed.
 * Speaking, history and learned words are activity, not content: they never
 * get content stamps.
 */

export const LEGACY = 'legacy';
/** Settings that belong to this device (voices, camera calibration, attached switches, lock): never synced. */
export const LOCAL_SETTINGS = new Set([
  'voiceURI', 'voiceIndex', 'voiceName', 'volume', 'gazeCalibration', 'uiLanguage', 'keepAwake', 'pointer', 'scanning', 'lock', 'pin',
]);
/** Device-specific settings left out of sync files entirely. */
export const FILE_STRIP_SETTINGS = ['voiceURI', 'voiceIndex', 'voiceName', 'gazeCalibration'];
const KNOWN_FIELDS = new Set([
  'id', 'name', 'layout', 'boards', 'rootId', 'quickBar', 'phrases', 'phraseCategories', 'schedules', 'aboutMe', 'settings',
  'lexicon', 'history', 'createdAt', 'updatedAt', 'sync',
]);
export const HISTORY_CAP = 100;
const MAX_COLS = 20;
const MAX_ROWS = 30;

// ---------------------------------------------------------------- device + clock

const randomId = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
};

let deviceId = randomId();
let clock = 0;
const contentListeners = new Set<() => void>();

export const getDeviceId = () => deviceId;
/** Tests and the device-id loader use this. Returns the previous clock so a simulator can switch devices. */
export function setDevice(id: string, clockValue?: number): number {
  const prev = clock;
  deviceId = id;
  if (clockValue !== undefined) clock = clockValue;
  return prev;
}
export const getClock = () => clock;

/** Load (or create) this device's id. It lives in IndexedDB meta, never in data, backups or sync files. */
export async function loadDeviceId(): Promise<string> {
  try {
    const { getMeta, setMeta } = await import('./db');
    const saved = await getMeta<string>('deviceId');
    if (typeof saved === 'string' && /^[\w-]{4,40}$/.test(saved)) deviceId = saved;
    else await setMeta('deviceId', deviceId);
  } catch { /* storage unavailable: an in-memory id still works for this session */ }
  return deviceId;
}

/** A new stamp. The hybrid clock never goes backwards and always beats anything this device has seen. */
export function tick(): SyncStamp {
  const t = Math.max(Date.now(), clock + 1);
  clock = t;
  return { t, d: deviceId };
}

const FUTURE_LIMIT = 2 * 24 * 3600 * 1000;
/** Advance the clock past every stamp in this data (after loading or merging). */
export function observeData(data: AppData) {
  const limit = Date.now() + FUTURE_LIMIT;
  const see = (s?: SyncInfo) => {
    if (!s) return;
    for (const v of Object.values(s.seen ?? {})) if (v > clock && v <= limit) clock = v;
  };
  for (const p of data.profiles) see(p.sync);
  see(data.library?.sync);
  for (const v of Object.values(data.sync?.removed ?? {})) if (v.t > clock && v.t <= limit) clock = v.t;
}

/** Called after every stamped content change (auto-sync listens to schedule a sync). */
export function onContentChange(fn: () => void): () => void {
  contentListeners.add(fn);
  return () => contentListeners.delete(fn);
}

// ---------------------------------------------------------------- small helpers

/** Order of stamps: time, then device id (seeded "legacy" stamps lose every tie). */
export const cmpStamp = (a: SyncStamp, b: SyncStamp) =>
  a.t - b.t || (a.d === b.d ? 0 : a.d === LEGACY ? -1 : b.d === LEGACY ? 1 : a.d < b.d ? -1 : 1);
export const enc = (s: string) => s.replace(/%/g, '%25').replace(/:/g, '%3A');
export const dec = (s: string) => s.replace(/%3A/g, ':').replace(/%25/g, '%');

/** Deep equality for JSON-like values (an `undefined` property counts as missing). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    if (a.length !== bb.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], bb[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  let na = 0;
  for (const k in ao) {
    if (ao[k] === undefined) continue;
    na++;
    if (!same(ao[k], bo[k])) return false;
  }
  let nb = 0;
  for (const k in bo) if (bo[k] !== undefined) nb++;
  return na === nb;
}

/** JSON with sorted keys (a deterministic tie-breaker and comparison form). */
export function canon(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
}

// ---------------------------------------------------------------- items

export type Items = Map<string, unknown>;

/** Keys of a list whose elements have ids; duplicate ids get a #n suffix so nothing is dropped. */
function listKeys<T>(arr: T[], idOf: (x: T) => string): string[] {
  const used = new Map<string, number>();
  return arr.map((x) => {
    const id = enc(String(idOf(x) ?? ''));
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    return n ? `${id}#${n}` : id;
  });
}

function addList<T>(out: Items, prefix: string, orderKey: string, arr: T[] | undefined, idOf: (x: T) => string) {
  if (!Array.isArray(arr)) return;
  const keys = listKeys(arr, idOf);
  arr.forEach((x, i) => out.set(`${prefix}:${keys[i]}`, x));
  out.set(orderKey, keys);
}

export function addBoard(out: Items, id: string, b: Board) {
  const { cells, id: _id, ...meta } = b;
  void _id;
  const eid = enc(id);
  out.set(`b:${eid}`, meta);
  const cols = b.cols;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c) out.set(`c:${eid}:${Math.floor(i / cols)}:${i % cols}`, c);
  }
}

/** Sections of a profile; each is diffed only when its object reference changed. */
const SECTIONS: { ref: (p: Profile) => unknown; add: (p: Profile, out: Items) => void }[] = [
  { ref: (p) => `${p.name}\u0000${p.layout}\u0000${p.rootId}`, add: (p, out) => out.set('meta', { name: p.name, layout: p.layout, rootId: p.rootId }) },
  { ref: (p) => p.quickBar, add: (p, out) => addList(out, 'q', 'qo', p.quickBar, (b) => b.id) },
  { ref: (p) => p.phrases, add: (p, out) => addList(out, 'ph', 'po', p.phrases, (x) => x.id) },
  {
    ref: (p) => p.phraseCategories,
    add: (p, out) => {
      if (!Array.isArray(p.phraseCategories)) return;
      const keys = listKeys(p.phraseCategories, (c) => c);
      keys.forEach((k) => out.set(`pc:${k}`, true));
      out.set('pco', keys);
    },
  },
  { ref: (p) => p.schedules, add: (p, out) => addList(out, 's', 'so', p.schedules, (x) => x.id) },
  { ref: (p) => p.aboutMe, add: (p, out) => { if (p.aboutMe !== undefined) out.set('about', p.aboutMe); } },
  {
    ref: (p) => p.settings,
    add: (p, out) => {
      const s = (p.settings ?? {}) as unknown as Record<string, unknown>;
      for (const k of Object.keys(s)) if (!LOCAL_SETTINGS.has(k) && s[k] !== undefined) out.set(`set:${enc(k)}`, s[k]);
    },
  },
];

function addExtras(p: Profile, out: Items) {
  const o = p as unknown as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KNOWN_FIELDS.has(k) && o[k] !== undefined) out.set(`f:${enc(k)}`, o[k]);
}

/** Every content item of a profile. */
export function profileItems(p: Profile): Items {
  const out: Items = new Map();
  for (const s of SECTIONS) s.add(p, out);
  for (const [id, b] of Object.entries(p.boards ?? {})) addBoard(out, id, b);
  addExtras(p, out);
  return out;
}

/** Every item of the shared symbol library. */
export function libraryItems(lib: SymbolLibrary): Items {
  const out: Items = new Map();
  const cats = lib.categories ?? [];
  const ckeys = listKeys(cats, (c) => c.id);
  cats.forEach((c, i) => {
    const { symbols, id: _id, ...meta } = c;
    void _id;
    out.set(`lc:${ckeys[i]}`, meta);
    addList(out, `ls:${ckeys[i]}`, `lso:${ckeys[i]}`, symbols, (s) => s.id);
  });
  out.set('lco', ckeys);
  for (const [k, v] of Object.entries(lib.additions ?? {})) addList(out, `la:${enc(k)}`, `lao:${enc(k)}`, v, (s) => s.id);
  return out;
}

// ---------------------------------------------------------------- rebuilding from items

function ordered<T>(present: Map<string, T>, order: unknown): T[] {
  const out: T[] = [];
  const done = new Set<string>();
  if (Array.isArray(order)) {
    for (const k of order) {
      if (typeof k === 'string' && present.has(k) && !done.has(k)) { done.add(k); out.push(present.get(k)!); }
    }
  }
  for (const k of [...present.keys()].sort()) if (!done.has(k)) out.push(present.get(k)!);
  return out;
}

const idPart = (s: string) => dec(s.replace(/#\d+$/, ''));

/**
 * Build a profile from items. `base` supplies what items don't hold (id,
 * history, learned words, device-only settings). Boards grow if a surviving
 * button lies outside their size, and links to missing boards are dropped.
 */
export function profileFromItems(base: Profile, items: Items): Profile {
  const lists: Record<string, Map<string, unknown>> = { q: new Map(), ph: new Map(), pc: new Map(), s: new Map() };
  const boardMeta = new Map<string, Record<string, unknown>>();
  const cells = new Map<string, { r: number; c: number; v: Cell }[]>();
  const settings: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  for (const [k, v] of items) {
    const i = k.indexOf(':');
    const pre = i < 0 ? k : k.slice(0, i);
    const rest = i < 0 ? '' : k.slice(i + 1);
    if (pre === 'c') {
      const j2 = rest.lastIndexOf(':');
      const j1 = rest.lastIndexOf(':', j2 - 1);
      const bid = rest.slice(0, j1);
      const r = Number(rest.slice(j1 + 1, j2));
      const c = Number(rest.slice(j2 + 1));
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLS) continue;
      if (!cells.has(bid)) cells.set(bid, []);
      cells.get(bid)!.push({ r, c, v: v as Cell });
    } else if (pre === 'b') boardMeta.set(rest, v as Record<string, unknown>);
    else if (pre in lists) lists[pre].set(rest, v);
    else if (pre === 'set') settings[dec(rest)] = v;
    else if (pre === 'f') extras[dec(rest)] = v;
  }
  const boards: Record<string, Board> = {};
  for (const eid of [...boardMeta.keys()].sort()) {
    const meta = boardMeta.get(eid)!;
    const id = dec(eid);
    const list = cells.get(eid) ?? [];
    let cols = Math.min(MAX_COLS, Math.max(1, Number(meta.cols) || 1));
    let rows = Math.min(MAX_ROWS, Math.max(1, Number(meta.rows) || 1));
    for (const x of list) { cols = Math.max(cols, x.c + 1); rows = Math.max(rows, x.r + 1); }
    const arr: Cell[] = Array(cols * rows).fill(null);
    for (const x of list) arr[x.r * cols + x.c] = x.v;
    boards[id] = { ...(meta as unknown as Omit<Board, 'id' | 'cells'>), id, cols, rows, cells: arr };
  }
  // Links to boards that did not survive are dropped (copy-on-write).
  for (const b of Object.values(boards)) {
    b.cells = b.cells.map((c) => (c?.link && !boards[c.link] ? (({ link: _l, ...rest }) => { void _l; return rest; })(c) : c));
  }
  const meta = (items.get('meta') ?? {}) as { name?: string; layout?: Profile['layout']; rootId?: string };
  const ids = Object.keys(boards);
  let rootId = meta.rootId ?? base.rootId;
  if (!boards[rootId]) rootId = boards.home ? 'home' : ids.sort()[0] ?? base.rootId;
  const local: Record<string, unknown> = {};
  const baseSettings = (base.settings ?? {}) as unknown as Record<string, unknown>;
  for (const k of Object.keys(baseSettings)) if (LOCAL_SETTINGS.has(k) && baseSettings[k] !== undefined) local[k] = baseSettings[k];
  const known: Partial<Profile> = {
    id: base.id,
    name: meta.name ?? base.name,
    layout: meta.layout ?? base.layout,
    boards,
    rootId,
    quickBar: ordered(lists.q, items.get('qo')) as Profile['quickBar'],
    phrases: ordered(lists.ph, items.get('po')) as Profile['phrases'],
    phraseCategories: ordered(new Map([...lists.pc.keys()].map((k) => [k, idPart(k)])), items.get('pco')),
    schedules: ordered(lists.s, items.get('so')) as Profile['schedules'],
    aboutMe: (items.has('about') ? items.get('about') : base.aboutMe) as Profile['aboutMe'],
    settings: { ...settings, ...local } as unknown as Profile['settings'],
    lexicon: base.lexicon,
    history: base.history,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    sync: base.sync,
  };
  return { ...extras, ...known } as Profile;
}

export function libraryFromItems(items: Items): SymbolLibrary {
  const catMeta = new Map<string, Record<string, unknown>>();
  const syms = new Map<string, Map<string, LibrarySymbol>>();
  const adds = new Map<string, Map<string, LibrarySymbol>>();
  for (const [k, v] of items) {
    const i = k.indexOf(':');
    if (i < 0) continue;
    const pre = k.slice(0, i);
    const rest = k.slice(i + 1);
    if (pre === 'lc') catMeta.set(rest, v as Record<string, unknown>);
    else if (pre === 'ls' || pre === 'la') {
      const j = rest.lastIndexOf(':');
      const group = rest.slice(0, j);
      const m = pre === 'ls' ? syms : adds;
      if (!m.has(group)) m.set(group, new Map());
      m.get(group)!.set(rest.slice(j + 1), v as LibrarySymbol);
    }
  }
  const metaMap = new Map([...catMeta.keys()].map((k) => [k, k]));
  const categories: LibraryCategory[] = ordered(metaMap, items.get('lco')).map((ck) => ({
    ...(catMeta.get(ck) as unknown as Omit<LibraryCategory, 'id' | 'symbols'>),
    id: idPart(ck),
    symbols: ordered(syms.get(ck) ?? new Map(), items.get(`lso:${ck}`)),
  }));
  const additions: Record<string, LibrarySymbol[]> = {};
  for (const g of [...adds.keys()].sort()) {
    const list = ordered(adds.get(g)!, items.get(`lao:${g}`));
    if (list.length) additions[dec(g)] = list;
  }
  return { categories, additions };
}

// ---------------------------------------------------------------- seeding + reconciling

export const emptySync = (): SyncInfo => ({ stamps: {}, tombstones: {}, seen: {} });

const ACTIVITY_KEY = /^(h:|lex:)/;
/** Order keys (qo, po, lso:…) and activity keys. */
export const isActivityKey = (k: string) => ACTIVITY_KEY.test(k);

/**
 * Make stamps agree with the items: every present item has a stamp (old data
 * is seeded with `seed`, so first syncs behave like the old merge), removed
 * items keep or get a tombstone. Returns the same object when nothing changed.
 */
export function reconcile(items: Items, sync: SyncInfo | undefined, seedT: number): SyncInfo {
  const base = sync ?? emptySync();
  let stamps = base.stamps;
  let tombs = base.tombstones;
  let copied = false;
  const copy = () => { if (!copied) { stamps = { ...stamps }; tombs = { ...tombs }; copied = true; } };
  for (const k of items.keys()) {
    const s = Object.hasOwn(stamps, k) ? stamps[k] : undefined;
    const tb = Object.hasOwn(tombs, k) ? tombs[k] : undefined;
    if (!s) {
      copy();
      stamps[k] = tb ? { t: tb.t, d: tb.d } : { t: seedT, d: LEGACY };
      if (tb) delete tombs[k];
    } else if (tb) {
      copy();
      if (cmpStamp(tb, s) > 0) stamps[k] = tb;
      delete tombs[k];
    }
  }
  for (const k of Object.keys(stamps)) {
    if (items.has(k)) continue;
    copy();
    const s = stamps[k];
    const tb = Object.hasOwn(tombs, k) ? tombs[k] : undefined;
    if (!tb || cmpStamp(s, tb) > 0) tombs[k] = s;
    delete stamps[k];
  }
  if (!copied && sync) return sync;
  return { ...base, stamps, tombstones: tombs, seen: base.seen ?? {} };
}

export interface CapturedSync { profiles: Map<string, unknown>; library: unknown; data: unknown }

/**
 * Take the raw sync info out of loaded data before validation runs, so a
 * validator that rebuilds objects field by field can never drop it.
 */
export function captureSync(data: unknown): CapturedSync {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const profiles = new Map<string, unknown>();
  if (Array.isArray(d.profiles)) {
    for (const p of d.profiles) {
      if (p && typeof p === 'object' && typeof (p as Profile).id === 'string') profiles.set((p as Profile).id, (p as Profile).sync);
    }
  }
  const lib = d.library && typeof d.library === 'object' ? (d.library as SymbolLibrary).sync : undefined;
  return { profiles, library: lib, data: d.sync };
}

/** Put validated sync info back and seed stamps for anything without them (end of migrate). */
export function restoreSync(data: AppData, c: CapturedSync) {
  const used = new Set<string>();
  for (const p of data.profiles) {
    // A profile that was given a fresh id (a duplicate) starts with fresh stamps.
    p.sync = used.has(p.id) ? undefined : cleanSyncInfo(c.profiles.get(p.id));
    used.add(p.id);
  }
  if (data.library) data.library.sync = cleanSyncInfo(c.library);
  data.sync = cleanDataSync(c.data);
  migrateSync(data);
}

/** Seed or repair the sync info of loaded data (called from migrate after validation). */
export function migrateSync(data: AppData) {
  for (const p of data.profiles) {
    p.sync = reconcile(profileItems(p), p.sync, p.updatedAt ?? p.createdAt ?? 0);
  }
  if (data.library) data.library.sync = reconcile(libraryItems(data.library), data.library.sync, 0);
  data.sync = { removed: data.sync?.removed ?? {} };
}

// ---------------------------------------------------------------- stamping local changes

class Recorder {
  private stamps: Record<string, SyncStamp> | null = null;
  private tombs: Record<string, SyncStamp> | null = null;
  changed = false;
  constructor(private base: SyncInfo, private s: SyncStamp) {}
  private copy() {
    if (!this.stamps) { this.stamps = { ...this.base.stamps }; this.tombs = { ...this.base.tombstones }; }
  }
  mark(k: string, present: boolean) {
    this.copy();
    this.changed = true;
    if (present) { this.stamps![k] = this.s; delete this.tombs![k]; } else { this.tombs![k] = this.s; delete this.stamps![k]; }
  }
  tomb(k: string, s = this.s) { this.copy(); this.changed = true; this.tombs![k] = s; }
  result(extra?: Partial<SyncInfo>): SyncInfo {
    if (!this.changed && !extra) return this.base;
    const seen = this.changed ? { ...this.base.seen, [this.s.d]: Math.max(this.base.seen?.[this.s.d] ?? 0, this.s.t) } : this.base.seen;
    return { ...this.base, stamps: this.stamps ?? this.base.stamps, tombstones: this.tombs ?? this.base.tombstones, seen, ...extra };
  }
}

function diffItems(a: Items, b: Items, rec: Recorder) {
  for (const [k, v] of b) if (!a.has(k) || !same(a.get(k), v)) rec.mark(k, true);
  for (const k of a.keys()) if (!b.has(k)) rec.mark(k, false);
}

function freshSync(items: Items, s: SyncStamp): SyncInfo {
  const stamps: Record<string, SyncStamp> = {};
  for (const k of items.keys()) stamps[k] = s;
  return { stamps, tombstones: {}, seen: { [s.d]: s.t } };
}

/** Stamp the content differences between two versions of a profile. */
export function stampProfile(prev: Profile, next: Profile, s: SyncStamp, opts: { activity?: boolean } = {}): SyncInfo {
  const base = prev.sync ?? reconcile(profileItems(prev), undefined, prev.updatedAt ?? prev.createdAt ?? 0);
  const rec = new Recorder(base, s);
  for (const sec of SECTIONS) {
    const ra = sec.ref(prev);
    const rb = sec.ref(next);
    if (ra === rb) continue;
    const a: Items = new Map();
    const b: Items = new Map();
    sec.add(prev, a);
    sec.add(next, b);
    diffItems(a, b, rec);
  }
  if (prev.boards !== next.boards) {
    const ids = new Set([...Object.keys(prev.boards ?? {}), ...Object.keys(next.boards ?? {})]);
    for (const id of ids) {
      const ba = prev.boards?.[id];
      const bb = next.boards?.[id];
      if (ba === bb) continue;
      const a: Items = new Map();
      const b: Items = new Map();
      if (ba) addBoard(a, id, ba);
      if (bb) addBoard(b, id, bb);
      diffItems(a, b, rec);
    }
  }
  {
    const a: Items = new Map();
    const b: Items = new Map();
    addExtras(prev, a);
    addExtras(next, b);
    diffItems(a, b, rec);
  }
  let extra: Partial<SyncInfo> | undefined;
  if (opts.activity !== false) {
    if (prev.history !== next.history) historyTombs(prev.history ?? [], next.history ?? [], rec);
    if (prev.lexicon !== next.lexicon) {
      const had = Object.keys(prev.lexicon ?? {}).length;
      const has = Object.keys(next.lexicon ?? {}).length;
      if (had && !has) rec.tomb('lex:*');
      else if (has) extra = { lexT: s.t };
    }
  }
  return rec.result(extra);
}

/** History rows a grown-up removed (not the ones that fell off the end) become tombstones. */
function historyTombs(prev: Profile['history'], next: Profile['history'], rec: Recorder) {
  if (!prev.length) return;
  if (!next.length) { rec.tomb('h:*'); return; }
  const keep = new Set(next.map((h) => `${h.t}\u0000${h.text}`));
  // Below the cap nothing falls off the end, so anything missing was removed on purpose.
  const oldest = next.length < HISTORY_CAP ? -Infinity : Math.min(...next.map((h) => h.t));
  for (const h of prev) if (!keep.has(`${h.t}\u0000${h.text}`) && h.t > oldest) rec.tomb(`h:${h.t}`);
}

export function stampLibrary(prev: SymbolLibrary | undefined, next: SymbolLibrary, s: SyncStamp): SyncInfo {
  const pl = prev ?? { categories: [], additions: {} };
  const base = pl.sync ?? reconcile(libraryItems(pl), undefined, 0);
  const rec = new Recorder(base, s);
  diffItems(libraryItems(pl), libraryItems(next), rec);
  return rec.result();
}

/** Newest content change in a profile (stamps and deletions, not activity). */
export function maxStampOf(p: Profile): number {
  let m = 0;
  for (const v of Object.values(p.sync?.stamps ?? {})) if (v.t > m) m = v.t;
  for (const [k, v] of Object.entries(p.sync?.tombstones ?? {})) if (v.t > m && !isActivityKey(k)) m = v.t;
  return m;
}

/**
 * Record every content change from `prev` to `next` (the store's single
 * stamping point). Sync info is always carried over from `prev`, so restoring
 * an old snapshot counts as a new change and is not undone by the next sync.
 * `activity: false` (restores) records no history deletions.
 */
export function stampData(prev: AppData, next: AppData, opts: { activity?: boolean } = {}): AppData {
  if (prev === next) return next;
  let s: SyncStamp | null = null;
  const stamp = () => (s ??= tick());
  let content = false;
  const prevById = new Map(prev.profiles.map((p) => [p.id, p]));
  const removed: DataSyncInfo['removed'] = { ...(prev.sync?.removed ?? {}) };
  let removedChanged = false;
  const profiles = next.profiles.map((np) => {
    const pp = prevById.get(np.id);
    if (pp === np) return np;
    if (!pp) {
      // New on this device. A profile brought back after being deleted is a fresh change everywhere;
      // otherwise (an import) it keeps the stamps it came with.
      const wasRemoved = Object.hasOwn(removed, np.id);
      if (wasRemoved) { delete removed[np.id]; removedChanged = true; }
      content = true;
      const items = profileItems(np);
      if (np.sync && !wasRemoved) return { ...np, sync: reconcile(items, np.sync, np.updatedAt ?? np.createdAt ?? 0) };
      return { ...np, sync: freshSync(items, stamp()) };
    }
    const before = pp.sync;
    const sync = stampProfile(pp, np, stamp(), opts);
    if (sync === before && np.sync === before) return np;
    if (sync.stamps !== before?.stamps || sync.tombstones !== before?.tombstones) content = true;
    return { ...np, sync };
  });
  const nextIds = new Set(next.profiles.map((p) => p.id));
  for (const pp of prev.profiles) {
    if (nextIds.has(pp.id)) continue;
    const st = stamp();
    // A deletion must beat every change in the profile, even ones stamped by a device whose clock runs ahead.
    if (pp.id === '__proto__') continue;
    removed[pp.id] = st.t > maxStampOf(pp) ? st : { t: maxStampOf(pp) + 1, d: st.d };
    removedChanged = true;
    content = true;
  }
  let library = next.library;
  if (next.library && prev.library !== next.library) {
    const sync = stampLibrary(prev.library, next.library, stamp());
    if (sync !== prev.library?.sync) content = true;
    library = { ...next.library, sync };
  } else if (next.library && !next.library.sync && prev.library?.sync) {
    library = { ...next.library, sync: prev.library.sync };
  }
  const out: AppData = { ...next, profiles, library, sync: removedChanged ? { removed } : prev.sync ?? next.sync ?? { removed: {} } };
  if (content) for (const fn of contentListeners) { try { fn(); } catch { /* listeners never break editing */ } }
  return out;
}
