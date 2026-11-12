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

export async function loadData(): Promise<AppData | undefined> {
  try {
    return (await (await db()).get('kv', 'data')) as AppData | undefined;
  } catch (e) {
    console.error('loadData failed', e);
    return undefined;
  }
}

export async function saveData(data: AppData) {
  await (await db()).put('kv', data, 'data');
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
