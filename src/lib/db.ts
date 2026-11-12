import { openDB, type IDBPDatabase } from 'idb';
import type { AppData } from '../types';

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
}

export interface Snapshot {
  id?: number;
  t: number;
  reason: string;
  data: AppData;
}

let dbp: Promise<IDBPDatabase> | null = null;

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
const MAX_SNAPSHOTS = 15;

export async function addSnapshot(data: AppData, reason: string) {
  const d = await db();
  await d.add('snapshots', { t: Date.now(), reason, data: structuredClone(data) } satisfies Snapshot);
  const keys = (await d.getAllKeys('snapshots')) as number[];
  if (keys.length > MAX_SNAPSHOTS) {
    const tx = d.transaction('snapshots', 'readwrite');
    for (const k of keys.slice(0, keys.length - MAX_SNAPSHOTS)) await tx.store.delete(k);
    await tx.done;
  }
}

export async function listSnapshots(): Promise<Omit<Snapshot, 'data'>[]> {
  const all = (await (await db()).getAll('snapshots')) as Snapshot[];
  return all.map(({ id, t, reason }) => ({ id, t, reason })).reverse();
}

export async function getSnapshot(id: number): Promise<Snapshot | undefined> {
  return (await (await db()).get('snapshots', id)) as Snapshot | undefined;
}

// ---------- usage log ----------
export async function logUsage(entry: Omit<LogEntry, 'id' | 't'>) {
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
