import { openDB, type IDBPDatabase } from 'idb';
import type { AppData } from '../types';
import { withoutTransient } from './validate';

/**
 * Local persistence (IndexedDB). Everything stays on the device.
 *  - kv:        app data (profiles, boards, settings)
 *  - assets:    user photos and recorded audio (Blobs)
 *  - snapshots: automatic versioned backups of app data
 *  - log:       opt-in usage log for insights
 */

export interface LogEntry {
  id?: number;
  t: number;
  profileId: string;
  kind: 'word' | 'sentence' | 'phrase';
  text: string;
  /** Tapped by a communication partner while modelling (not the person's own use). */
  modeled?: boolean;
}

/**
 * Snapshot classes are kept separately, so a burst of pre-action snapshots
 * can never push out the daily ones (and the other way round).
 */
export type SnapshotKind = 'daily' | 'action' | 'manual';

export interface Snapshot {
  id?: number;
  t: number;
  reason: string;
  kind?: SnapshotKind;
  data: AppData;
}

export const DAILY_SNAPSHOT_REASON = 'Automatic daily backup';
export const MANUAL_SNAPSHOT_REASON = 'Manual snapshot';

let dbp: Promise<IDBPDatabase> | null = null;

let writesBlocked = false;
/**
 * Set while the app runs on placeholder data because saved data couldn't be
 * used: snapshots and backup files are refused so the placeholder never
 * replaces anything real.
 */
export const blockStoredWrites = (on: boolean) => { writesBlocked = on; };
export const storedWritesBlocked = () => writesBlocked;

function db() {
  if (!dbp) {
    dbp = openDB('caleb', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        d.createObjectStore('assets');
        d.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
        const log = d.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
        log.createIndex('t', 't');
      },
    });
  }
  return dbp;
}

/** Throws if storage can't be read (so callers never mistake an error for "no data"). */
export async function loadData(): Promise<AppData | undefined> {
  return (await (await db()).get('kv', 'data')) as AppData | undefined;
}

export async function saveData(data: AppData) {
  await (await db()).put('kv', data, 'data');
}

/** Data and revision read in one transaction (so they always belong together). */
export async function loadDataWithRev(): Promise<{ data: AppData | undefined; rev: number }> {
  const tx = (await db()).transaction('kv', 'readonly');
  const [data, rev] = await Promise.all([tx.store.get('data'), tx.store.get('rev')]);
  await tx.done;
  return { data: data as AppData | undefined, rev: (rev as number | undefined) ?? 0 };
}

export async function getRev(): Promise<number> {
  return ((await (await db()).get('kv', 'rev')) as number | undefined) ?? 0;
}

/**
 * Writes only if nobody else (another tab/window) saved since `expectedRev`.
 * Returns the new revision, or null on conflict.
 */
export async function saveDataChecked(data: AppData, expectedRev: number): Promise<number | null> {
  const tx = (await db()).transaction('kv', 'readwrite');
  const cur = ((await tx.store.get('rev')) as number | undefined) ?? 0;
  if (cur !== expectedRev) {
    await tx.done;
    return null;
  }
  await tx.store.put(data, 'data');
  await tx.store.put(cur + 1, 'rev');
  await tx.done;
  return cur + 1;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('kv', value, key);
}

// ---------- assets ----------
const urlCache = new Map<string, string>();

export async function putAsset(id: string, blob: Blob) {
  await (await db()).put('assets', blob, id);
  const old = urlCache.get(id);
  if (old) URL.revokeObjectURL(old);
  urlCache.delete(id);
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return (await (await db()).get('assets', id)) as Blob | undefined;
}

export async function deleteAsset(id: string) {
  await (await db()).delete('assets', id);
}

export async function allAssetIds(): Promise<string[]> {
  return (await (await db()).getAllKeys('assets')) as string[];
}

export async function assetURL(id: string): Promise<string | undefined> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getAsset(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

// ---------- snapshots ----------
/** How many snapshots of each class are kept. */
export const SNAPSHOT_KEEP: Record<SnapshotKind, number> = { daily: 10, action: 10, manual: 5 };
/** A second snapshot with the same reason this soon after the last one is skipped (the older one holds the state before the burst). */
const COALESCE_MS = 5 * 60 * 1000;

export const snapshotKind = (reason: string): SnapshotKind =>
  reason === DAILY_SNAPSHOT_REASON ? 'daily' : reason === MANUAL_SNAPSHOT_REASON ? 'manual' : 'action';

type SnapMeta = Omit<Snapshot, 'data'> & { id: number; kind: SnapshotKind };

/** Small index of snapshot metadata (kept in kv) so rotation and listing never load every snapshot. */
async function snapIndex(d: IDBPDatabase): Promise<SnapMeta[]> {
  const keys = (await d.getAllKeys('snapshots')) as number[];
  const idx = ((await d.get('kv', 'snapIndex')) as SnapMeta[] | undefined) ?? [];
  const byId = new Map((Array.isArray(idx) ? idx : []).map((m) => [m.id, m]));
  let changed = !Array.isArray(idx) || idx.length !== keys.length;
  for (const k of keys) {
    if (byId.has(k)) continue;
    const s = (await d.get('snapshots', k)) as Snapshot | undefined;
    if (!s) continue;
    byId.set(k, { id: k, t: s.t, reason: s.reason, kind: s.kind ?? snapshotKind(s.reason) });
    changed = true;
  }
  const out = keys.map((k) => byId.get(k)).filter((m): m is SnapMeta => !!m);
  if (changed) await d.put('kv', out, 'snapIndex');
  return out;
}

/**
 * Saves a versioned copy of the data. Returns false when it was skipped
 * because an identical-reason snapshot was taken moments ago.
 */
export async function addSnapshot(data: AppData, reason: string, kind: SnapshotKind = snapshotKind(reason)): Promise<boolean> {
  // The data in memory is a placeholder (saved data couldn't be used): never let it into a snapshot.
  if (writesBlocked) return false;
  const d = await db();
  const idx = await snapIndex(d);
  const now = Date.now();
  if (kind === 'action') {
    const lastSame = idx.filter((m) => m.kind === kind).pop();
    if (lastSame && lastSame.reason === reason && now - lastSame.t >= 0 && now - lastSame.t < COALESCE_MS) return false;
  }
  const id = (await d.add('snapshots', { t: now, reason, kind, data: structuredClone(withoutTransient(data)) } satisfies Snapshot)) as number;
  idx.push({ id, t: now, reason, kind });
  const drop = new Set<number>();
  for (const k of Object.keys(SNAPSHOT_KEEP) as SnapshotKind[]) {
    const ofKind = idx.filter((m) => m.kind === k);
    for (const m of ofKind.slice(0, Math.max(0, ofKind.length - SNAPSHOT_KEEP[k]))) drop.add(m.id);
  }
  const tx = d.transaction(['snapshots', 'kv'], 'readwrite');
  for (const k of drop) await tx.objectStore('snapshots').delete(k);
  await tx.objectStore('kv').put(idx.filter((m) => !drop.has(m.id)), 'snapIndex');
  await tx.done;
  return true;
}

export async function listSnapshots(): Promise<Omit<Snapshot, 'data'>[]> {
  const idx = await snapIndex(await db());
  return idx.map(({ id, t, reason, kind }) => ({ id, t, reason, kind })).reverse();
}

export async function getSnapshot(id: number): Promise<Snapshot | undefined> {
  return (await (await db()).get('snapshots', id)) as Snapshot | undefined;
}

// ---------- usage log ----------
let logPaused = false;
/** "Private for now": nothing is written to the usage log while paused (whoever asks). */
export const setUsageLogPaused = (on: boolean) => { logPaused = on; };

export async function logUsage(entry: Omit<LogEntry, 'id' | 't'>) {
  if (logPaused) return;
  try {
    await (await db()).add('log', { ...entry, t: Date.now() });
  } catch { /* logging must never break talking */ }
}

export async function getLog(profileId: string, sinceMs = 0): Promise<LogEntry[]> {
  const d = await db();
  const range = IDBKeyRange.lowerBound(sinceMs);
  const all = (await d.getAllFromIndex('log', 't', range)) as LogEntry[];
  return all.filter((e) => e.profileId === profileId);
}

export async function clearLog(profileId?: string) {
  const d = await db();
  if (!profileId) return d.clear('log');
  const tx = d.transaction('log', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if ((cursor.value as LogEntry).profileId === profileId) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Ask the browser not to evict our storage (prevents data loss on web). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* ignore */ }
}

/**
 * Garbage-collect photos/recordings that nothing refers to any more.
 * An asset is only deleted after it has been unreferenced (by live data AND
 * every snapshot) for at least a day, so undo / cancel / restore stay safe.
 */
export async function gcAssets(liveRefs: Set<string>, refsOf: (data: unknown) => Set<string>): Promise<number> {
  const d = await db();
  const refs = new Set(liveRefs);
  for (const snap of (await d.getAll('snapshots')) as Snapshot[]) refsOf(snap.data).forEach((r) => refs.add(r));
  const candidates = ((await d.get('kv', 'gcCandidates')) as Record<string, number> | undefined) ?? {};
  const next: Record<string, number> = {};
  const now = Date.now();
  let deleted = 0;
  for (const id of (await d.getAllKeys('assets')) as string[]) {
    if (refs.has(id)) continue;
    const since = candidates[id] ?? now;
    if (now - since > 24 * 3600 * 1000) {
      await d.delete('assets', id);
      deleted++;
    } else next[id] = since;
  }
  await d.put('kv', next, 'gcCandidates');
  return deleted;
}
