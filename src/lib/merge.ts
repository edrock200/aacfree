import type { AppData, Profile, SymbolLibrary, SyncInfo, SyncStamp } from '../types';
import {
  FILE_STRIP_SETTINGS, HISTORY_CAP, LEGACY, canon, cmpStamp, dec, isActivityKey, libraryFromItems, libraryItems, maxStampOf,
  profileFromItems, profileItems, reconcile, same, type Items,
} from './stamps';

/**
 * Change-by-change merging of AACFree data from any number of devices.
 *
 * Each item (one button, one phrase, one setting…) carries a stamp `{ t, d }`.
 * For every item the newer stamp wins (ties: a deletion wins, then a fixed
 * order of the values), so merging is commutative (A∪B = B∪A) and idempotent
 * (merging the same file twice changes nothing). If both devices changed the
 * same item without seeing each other's change, the newer one is kept and the
 * other is reported as a conflict (a snapshot is taken before applying, so the
 * older version can still be restored).
 *
 * Activity is not content: history rows are unioned (minus rows a grown-up
 * deleted), learned words take the larger count, and device-only settings
 * (voice, camera calibration, attached switch, lock) always stay as they are.
 */

export type ConflictKind = 'button' | 'board' | 'phrase' | 'category' | 'schedule' | 'quick' | 'about' | 'setting' | 'profile' | 'library' | 'other';

export interface SyncConflict {
  /** Profile name ('' for the symbol library). */
  profile: string;
  kind: ConflictKind;
  /** What changed, e.g. a button label or setting name. */
  what: string;
  /** Board name for buttons. */
  where?: string;
  kept: SyncStamp;
  lost: SyncStamp;
  keptDeleted?: boolean;
  lostDeleted?: boolean;
}

export interface MergeSummary {
  /** Profiles new on this device. */
  added: string[];
  /** Profiles deleted on another device. */
  removed: string[];
  /** Changes this device takes from the other side, by the device that made them. */
  received: Record<string, number>;
  /** Changes on this device that the other side did not have. */
  sent: number;
  conflicts: SyncConflict[];
  /** Anything on this device changes (content, stamps, history…). */
  localChanged: boolean;
  /** The other side lacks something (a shared file needs writing). */
  remoteChanged: boolean;
}

export const totalReceived = (s: MergeSummary) => Object.values(s.received).reduce((a, b) => a + b, 0);

interface Side { items: Items; sync: SyncInfo }

interface ItemsResult {
  items: Items;
  stamps: Record<string, SyncStamp>;
  tombs: Record<string, SyncStamp>;
  received: Record<string, number>;
  sent: number;
  conflicts: { key: string; kept: SyncStamp; lost: SyncStamp; keptDeleted: boolean; lostDeleted: boolean; keptSide: 'a' | 'b' }[];
  diffA: boolean;
  diffB: boolean;
}

const ORDER_KEY = /^(qo|po|pco|so|lco|lso:.*|lao:.*)$/;
const counts = (k: string) => !ORDER_KEY.test(k) && !isActivityKey(k);

/** A group whose children are deleted with their parent (a board and its buttons, a category and its symbols). */
interface Group {
  prefix: string;
  /** Parent key of a child key (null if `key` is not a child). */
  parentOf: (key: string) => string | null;
  children: (rest: string, key: string) => boolean;
  /** Extra items that come back with a resurrected parent (e.g. the folder button that linked to the board). */
  linked?: (rest: string, key: string, value: unknown) => boolean;
}

const PROFILE_GROUPS: Group[] = [{
  prefix: 'b:',
  parentOf: (key) => {
    if (!key.startsWith('c:')) return null;
    const j2 = key.lastIndexOf(':');
    const j1 = key.lastIndexOf(':', j2 - 1);
    return `b:${key.slice(2, j1)}`;
  },
  children: (rest, key) => key.startsWith(`c:${rest}:`),
  linked: (rest, key, value) => key.startsWith('c:') && !!value && typeof value === 'object' && (value as { link?: string }).link === dec(rest),
}];
const LIBRARY_GROUPS: Group[] = [{
  prefix: 'lc:',
  parentOf: (key) => {
    if (key.startsWith('lso:')) return `lc:${key.slice(4)}`;
    if (!key.startsWith('ls:')) return null;
    return `lc:${key.slice(3, key.lastIndexOf(':'))}`;
  },
  children: (rest, key) => key.startsWith(`ls:${rest}:`) || key === `lso:${rest}`,
}];

function mergeItems(a: Side, b: Side, groups: Group[]): ItemsResult {
  const r: ItemsResult = { items: new Map(), stamps: {}, tombs: {}, received: {}, sent: 0, conflicts: [], diffA: false, diffB: false };
  const keys = new Set<string>([...a.items.keys(), ...Object.keys(a.sync.tombstones), ...b.items.keys(), ...Object.keys(b.sync.tombstones)]);
  const ver = (s: Side, k: string) => {
    if (s.items.has(k)) return { s: s.sync.stamps[k], present: true };
    const t = Object.hasOwn(s.sync.tombstones, k) ? s.sync.tombstones[k] : undefined;
    return t ? { s: t, present: false } : undefined;
  };
  for (const k of keys) {
    const va = ver(a, k);
    const vb = ver(b, k);
    let win: 'a' | 'b' | 'eq';
    let src: Side = a;
    if (!va) win = 'b';
    else if (!vb) win = 'a';
    else {
      const c = cmpStamp(va.s, vb.s);
      if (c) win = c > 0 ? 'a' : 'b';
      else if (va.present !== vb.present) win = va.present ? 'b' : 'a';
      else {
        // The same change on both sides. Values can differ only by derived repairs (a link to a board
        // that is gone, a board grown to fit): pick one in a fixed order and don't count it as a change.
        win = 'eq';
        if (va.present && !same(a.items.get(k), b.items.get(k)) && canon(b.items.get(k)) > canon(a.items.get(k))) src = b;
      }
    }
    if (win === 'b') src = b;
    const w = win === 'b' ? vb! : va!;
    const ws = win === 'b' ? b : a;
    if (w.present) { r.items.set(k, src.items.get(k)); r.stamps[k] = w.s; } else r.tombs[k] = w.s;
    if (win === 'eq') continue;
    const lo = win === 'a' ? vb : va;
    const ls = win === 'a' ? b : a;
    if (win === 'a') r.diffB = true; else r.diffA = true;
    if (!lo) {
      // Only one side knows this item.
      if (counts(k) && w.present) { if (win === 'a') r.sent++; else r.received[w.s.d] = (r.received[w.s.d] ?? 0) + 1; }
      continue;
    }
    const differs = w.present !== lo.present || (w.present && !same(ws.items.get(k), ls.items.get(k)));
    if (!differs || !counts(k)) continue;
    if (win === 'a') r.sent++; else r.received[w.s.d] = (r.received[w.s.d] ?? 0) + 1;
    // A real conflict: the winning side never saw the losing change.
    if (lo.s.d !== LEGACY && lo.s.d !== w.s.d && (ws.sync.seen?.[lo.s.d] ?? 0) < lo.s.t) {
      r.conflicts.push({ key: k, kept: w.s, lost: lo.s, keptDeleted: !w.present, lostDeleted: !lo.present, keptSide: win });
    }
  }
  for (const g of groups) resurrect(r, a, b, g);
  for (const g of groups) dropOrphans(r, a, b, g);
  return r;
}

/** Children whose parent is gone (a symbol added to a category deleted later) are deleted with their own stamp. */
function dropOrphans(r: ItemsResult, a: Side, b: Side, g: Group) {
  for (const k of [...r.items.keys()]) {
    const parent = g.parentOf(k);
    if (parent === null || r.items.has(parent)) continue;
    const s = r.stamps[k];
    r.items.delete(k);
    delete r.stamps[k];
    r.tombs[k] = s;
    // Whichever side still shows it must learn the deletion.
    if (a.items.has(k)) r.diffA = true;
    if (b.items.has(k)) r.diffB = true;
  }
}

/**
 * A board (or library category) deleted on one device while a button in it
 * was changed later on another comes back whole: its details and every button
 * deleted together with it, stamped with the newest change, so the result is
 * the same whichever device merges first.
 */
function resurrect(r: ItemsResult, a: Side, b: Side, g: Group) {
  for (const [pk, T] of Object.entries(r.tombs)) {
    if (!pk.startsWith(g.prefix)) continue;
    const rest = pk.slice(g.prefix.length);
    let R: SyncStamp | null = null;
    const newer: string[] = [];
    for (const [k, s] of Object.entries(r.stamps)) {
      if (!g.children(rest, k) || cmpStamp(s, T) <= 0) continue;
      newer.push(k);
      if (!R || cmpStamp(s, R) > 0) R = s;
    }
    if (!R) continue;
    const holder = a.items.has(pk) ? a : b.items.has(pk) ? b : null;
    if (!holder) {
      // Nothing to bring back: drop the orphans deterministically.
      for (const k of newer) { r.tombs[k] = r.stamps[k]; delete r.stamps[k]; r.items.delete(k); }
      continue;
    }
    r.items.set(pk, holder.items.get(pk));
    r.stamps[pk] = R;
    delete r.tombs[pk];
    for (const [k, s] of Object.entries(r.tombs)) {
      if (cmpStamp(s, T) !== 0) continue;
      const src = a.items.has(k) ? a : b.items.has(k) ? b : null;
      if (!src) continue;
      const v = src.items.get(k);
      if (!g.children(rest, k) && !g.linked?.(rest, k, v)) continue;
      r.items.set(k, v);
      r.stamps[k] = R;
      delete r.tombs[k];
    }
  }
}

function mergeSeen(x: Record<string, number> = {}, y: Record<string, number> = {}): Record<string, number> {
  const m = new Map<string, number>(Object.entries(x));
  for (const [k, v] of Object.entries(y)) if (!(m.get(k)! >= v)) m.set(k, v);
  return Object.fromEntries([...m.entries()].sort(([p], [q]) => (p < q ? -1 : 1)));
}

const histKey = (h: { t: number; text: string }) => `${h.t}\u0000${h.text}`;

function mergeHistory(x: Profile['history'], y: Profile['history'], tombs: Record<string, SyncStamp>): Profile['history'] {
  const cut = tombs['h:*']?.t ?? -Infinity;
  const all = new Map<string, Profile['history'][number]>();
  for (const h of [...(x ?? []), ...(y ?? [])]) {
    if (!h || typeof h.text !== 'string' || typeof h.t !== 'number') continue;
    if (h.t <= cut || Object.hasOwn(tombs, `h:${h.t}`)) continue;
    const k = histKey(h);
    const cur = all.get(k);
    // The same sentence on both sides: keep one copy, chosen the same way whichever side merges.
    if (!cur || canon(h) < canon(cur)) all.set(k, h);
  }
  const out = [...all.values()].sort((p, q) => q.t - p.t || (p.text < q.text ? -1 : p.text > q.text ? 1 : 0)).slice(0, HISTORY_CAP);
  if (out.length >= HISTORY_CAP) {
    // Rows older than everything kept can never come back: forget their tombstones.
    const oldest = out[out.length - 1].t;
    for (const k of Object.keys(tombs)) if (k.startsWith('h:') && k !== 'h:*' && Number(k.slice(2)) < oldest) delete tombs[k];
  }
  return out;
}

function mergeLexicon(sides: { lex: Record<string, number>; lexT?: number }[], tombs: Record<string, SyncStamp>) {
  const cut = tombs['lex:*']?.t ?? -Infinity;
  const live = sides.filter((s) => (s.lexT ?? 0) > cut || cut === -Infinity);
  const m = new Map<string, number>();
  for (const s of live) {
    for (const [w, n] of Object.entries(s.lex ?? {})) {
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      if (!(m.get(w)! >= n)) m.set(w, n);
    }
  }
  const lexT = live.reduce<number | undefined>((acc, s) => (s.lexT !== undefined && (acc === undefined || s.lexT > acc) ? s.lexT : acc), undefined);
  return { lexicon: Object.fromEntries([...m.entries()].sort(([p], [q]) => (p < q ? -1 : 1))), lexT };
}

const sideOf = (p: Profile): Side => {
  const items = profileItems(p);
  return { items, sync: reconcile(items, p.sync, p.updatedAt ?? p.createdAt ?? 0) };
};

function describe(key: string, value: unknown, items: Items[]): { kind: ConflictKind; what: string; where?: string } {
  const v = (value ?? {}) as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  const i = key.indexOf(':');
  const pre = i < 0 ? key : key.slice(0, i);
  const rest = i < 0 ? '' : key.slice(i + 1);
  switch (pre) {
    case 'c': {
      const bid = rest.slice(0, rest.lastIndexOf(':', rest.lastIndexOf(':') - 1));
      const meta = items.map((m) => m.get(`b:${bid}`)).find(Boolean) as { name?: string } | undefined;
      return { kind: 'button', what: s(v.label), where: meta?.name ?? dec(bid) };
    }
    case 'b': return { kind: 'board', what: s(v.name) || dec(rest) };
    case 'ph': return { kind: 'phrase', what: s(v.text) };
    case 'pc': return { kind: 'category', what: dec(rest.replace(/#\d+$/, '')) };
    case 's': return { kind: 'schedule', what: s(v.name) };
    case 'q': return { kind: 'quick', what: s(v.label) };
    case 'about': return { kind: 'about', what: '' };
    case 'set': return { kind: 'setting', what: dec(rest) };
    case 'meta': return { kind: 'profile', what: s(v.name) };
    case 'lc': return { kind: 'library', what: s(v.name) };
    case 'ls': case 'la': return { kind: 'library', what: s(v.label) };
    default: return { kind: 'other', what: dec(rest || key) };
  }
}

function conflictsOf(r: ItemsResult, a: Side, b: Side, profile: string): SyncConflict[] {
  return r.conflicts.map((c) => {
    const lostSide = c.keptSide === 'a' ? b : a;
    const keptSide = c.keptSide === 'a' ? a : b;
    const value = lostSide.items.get(c.key) ?? keptSide.items.get(c.key);
    return { profile, ...describe(c.key, value, [r.items, a.items, b.items]), kept: c.kept, lost: c.lost, keptDeleted: c.keptDeleted || undefined, lostDeleted: c.lostDeleted || undefined };
  });
}

const sameHistory = (x: Profile['history'], y: Profile['history']) =>
  x.length === y.length && x.every((h, i) => h.t === y[i].t && h.text === y[i].text);

/** Merge two copies of the same profile. `local` keeps its device-only settings. */
export function mergeProfile(local: Profile, incoming: Profile): { profile: Profile; summary: MergeSummary } {
  const a = sideOf(local);
  const b = sideOf(incoming);
  const r = mergeItems(a, b, PROFILE_GROUPS);
  const history = mergeHistory(local.history ?? [], incoming.history ?? [], r.tombs);
  const { lexicon, lexT } = mergeLexicon([{ lex: local.lexicon, lexT: a.sync.lexT }, { lex: incoming.lexicon, lexT: b.sync.lexT }], r.tombs);
  const seen = mergeSeen(a.sync.seen, b.sync.seen);
  const sync: SyncInfo = { stamps: r.stamps, tombstones: r.tombs, seen, ...(lexT !== undefined ? { lexT } : {}) };
  const createdAt = Math.min(local.createdAt ?? Infinity, incoming.createdAt ?? Infinity);
  const updatedAt = Math.max(local.updatedAt ?? 0, incoming.updatedAt ?? 0) || undefined;
  const profile = profileFromItems({
    ...local, history, lexicon, sync, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(), updatedAt,
  }, r.items);
  const extra = (p: Profile, s: Side) => !sameHistory(p.history ?? [], history) || !same(p.lexicon ?? {}, lexicon) || !same(s.sync.seen ?? {}, seen) || s.sync.lexT !== lexT;
  return {
    profile,
    summary: {
      added: [], removed: [], received: r.received, sent: r.sent,
      conflicts: conflictsOf(r, a, b, profile.name || local.name || ''),
      localChanged: r.diffA || extra(local, a),
      remoteChanged: r.diffB || extra(incoming, b),
    },
  };
}

export function mergeLibrary(local: SymbolLibrary, incoming: SymbolLibrary): { library: SymbolLibrary; summary: MergeSummary } {
  const ai = libraryItems(local);
  const bi = libraryItems(incoming);
  const a: Side = { items: ai, sync: reconcile(ai, local.sync, 0) };
  const b: Side = { items: bi, sync: reconcile(bi, incoming.sync, 0) };
  const r = mergeItems(a, b, LIBRARY_GROUPS);
  const seen = mergeSeen(a.sync.seen, b.sync.seen);
  const library: SymbolLibrary = { ...libraryFromItems(r.items), sync: { stamps: r.stamps, tombstones: r.tombs, seen } };
  return {
    library,
    summary: {
      added: [], removed: [], received: r.received, sent: r.sent, conflicts: conflictsOf(r, a, b, ''),
      localChanged: r.diffA || !same(a.sync.seen ?? {}, seen), remoteChanged: r.diffB || !same(b.sync.seen ?? {}, seen),
    },
  };
}

/** A profile arriving on a new device leaves behind what only made sense on the other one. */
export function stripDeviceSettings(p: Profile): Profile {
  const settings = { ...p.settings } as unknown as Record<string, unknown>;
  for (const k of FILE_STRIP_SETTINGS) delete settings[k];
  return { ...p, settings: settings as unknown as Profile['settings'] };
}

const emptySummary = (): MergeSummary => ({ added: [], removed: [], received: {}, sent: 0, conflicts: [], localChanged: false, remoteChanged: false });

function addInto(t: MergeSummary, s: MergeSummary) {
  for (const [d, n] of Object.entries(s.received)) t.received[d] = (t.received[d] ?? 0) + n;
  t.sent += s.sent;
  t.conflicts.push(...s.conflicts);
  t.localChanged ||= s.localChanged;
  t.remoteChanged ||= s.remoteChanged;
}

const newestDevice = (p: Profile) => {
  let best: SyncStamp | null = null;
  for (const s of Object.values(p.sync?.stamps ?? {})) if (!best || cmpStamp(s, best) > 0) best = s;
  return best?.d ?? LEGACY;
};

/**
 * Merge synced data into this device's data. Profiles are matched by id; a
 * profile missing from `incoming` is left alone unless it was deleted there
 * (a manual sync file may hold only some profiles). Everything that is not
 * shared (active profile, onboarding, device-only settings) stays local.
 */
export function mergeData(local: AppData, incoming: AppData): { data: AppData; summary: MergeSummary } {
  const summary = emptySummary();
  const rl = local.sync?.removed ?? {};
  const ri = incoming.sync?.removed ?? {};
  const rm = new Map<string, SyncStamp>();
  for (const [id, s] of [...Object.entries(rl), ...Object.entries(ri)]) {
    const cur = rm.get(id);
    if (!cur || cmpStamp(s, cur) > 0) rm.set(id, s);
  }
  const own = (o: Record<string, SyncStamp>, id: string) => (Object.hasOwn(o, id) ? o[id] : undefined);
  for (const [id, s] of rm) {
    const x = own(rl, id);
    const y = own(ri, id);
    if (!x || cmpStamp(x, s) !== 0) summary.localChanged = true;
    if (!y || cmpStamp(y, s) !== 0) summary.remoteChanged = true;
  }
  const removed: Record<string, SyncStamp> = Object.fromEntries([...rm.entries()].sort(([p], [q]) => (p < q ? -1 : 1)));
  const inc = new Map(incoming.profiles.map((p) => [p.id, p]));
  const loc = new Map(local.profiles.map((p) => [p.id, p]));
  const order = [...local.profiles.map((p) => p.id), ...incoming.profiles.filter((p) => !loc.has(p.id)).map((p) => p.id)];
  const profiles: Profile[] = [];
  for (const id of order) {
    const L = loc.get(id);
    const I = inc.get(id);
    let merged: Profile;
    let part: MergeSummary | null = null;
    if (L && I) ({ profile: merged, summary: part } = mergeProfile(L, I));
    else merged = L ?? stripDeviceSettings(I!);
    const tomb = rm.get(id);
    if (tomb && maxStampOf(merged) <= tomb.t) {
      if (L) { summary.removed.push(L.name); summary.localChanged = true; }
      if (I) summary.remoteChanged = true;
      continue;
    }
    profiles.push(merged);
    if (part) addInto(summary, part);
    else if (L) { summary.sent++; summary.remoteChanged = true; }
    else {
      summary.added.push(I!.name);
      summary.localChanged = true;
      const d = newestDevice(I!);
      summary.received[d] = (summary.received[d] ?? 0) + 1;
    }
  }
  const lib = mergeLibrary(local.library ?? { categories: [], additions: {} }, incoming.library ?? { categories: [], additions: {} });
  addInto(summary, lib.summary);
  if (!profiles.length) {
    // Never end up with no profile at all: keep this device's.
    return { data: local, summary: { ...emptySummary(), remoteChanged: true } };
  }
  const activeProfileId = profiles.some((p) => p.id === local.activeProfileId) ? local.activeProfileId : profiles[0].id;
  if (activeProfileId !== local.activeProfileId) summary.localChanged = true;
  return { data: { ...local, profiles, activeProfileId, library: lib.library, sync: { removed } }, summary };
}
