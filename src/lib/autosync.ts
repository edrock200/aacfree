import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppData } from '../types';
import { applySyncedData, useStore } from '../store';
import { addSnapshot, getMeta, setMeta } from './db';
import { forgetKeys } from './crypto';
import { blobToDataURL } from './util';
import { getDeviceId, onContentChange } from './stamps';
import {
  buildSyncText, mergeData, mergeDevices, openSyncFile, peekSyncFile, totalReceived,
  type DeviceInfo, type MergeSummary, type OpenedSync, type SyncConflict,
} from './sync';

/**
 * Automatic sync through ONE shared file the family picks (for example in
 * Google Drive, OneDrive or Dropbox). Every device reads it, merges change by
 * change (merge.ts), applies what is new, and writes the result back:
 *   - when AACFree opens and whenever it comes back to the screen,
 *   - about 45 seconds after an edit, and every 5 minutes while open,
 *   - from "Sync now".
 * Android keeps the file through the system file picker (AACFreeFilesPlugin);
 * desktop Chrome/Edge keep a File System Access handle in IndexedDB. iPad,
 * iPhone and Firefox can't keep a file, so they use the manual Send/Receive.
 *
 * Safety: every device keeps all of its data locally, so overwriting the file
 * can never lose anything (a device whose change was overwritten writes it
 * again next time). Before writing, the file is re-read and compared, and the
 * merge is redone if another device wrote in between; after writing it is
 * read back and checked. The previous file text is kept on the device.
 * Background sync never interrupts talking: it waits while someone is
 * tapping or editing, and failures only show as a calm status line.
 */

export type SyncTarget = { kind: 'android'; uri: string; name: string } | { kind: 'fs'; name: string };
export interface SyncPrefs { enabled: boolean; target?: SyncTarget }
export interface SyncStatus { lastOk?: number; lastTry?: number; error?: string; running?: boolean }
export type SyncSource = 'auto' | 'now' | 'setup' | 'file';
export interface SyncLogEntry {
  t: number;
  source: SyncSource;
  received: Record<string, number>;
  sent: number;
  added: string[];
  removed: string[];
  conflicts: SyncConflict[];
}

interface AACFreeFilesPlugin {
  createDocument(o: { name: string }): Promise<{ uri: string; name: string }>;
  openDocument(): Promise<{ uri: string; name: string }>;
  /** With `part`, base64 chunks collect in a temp file; 'commit' copies it in one go and checks every byte. */
  writeDocument(o: { uri: string; text?: string; data?: string; part?: 'begin' | 'append' | 'commit' }): Promise<{ bytes?: number }>;
  readDocument(o: { uri: string }): Promise<{ text: string }>;
}
let plugin: AACFreeFilesPlugin | null = null;
const files = () => (plugin ??= registerPlugin<AACFreeFilesPlugin>('AACFreeFiles'));

type Writable = { write(d: Blob | string): Promise<void>; close(): Promise<void> };
type FileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
};
type PickerWindow = {
  showSaveFilePicker?(o: object): Promise<FileHandle>;
  showOpenFilePicker?(o: object): Promise<FileHandle[]>;
};

const FILE_NAME = 'aacfree-sync.json';
const INTERVAL = 5 * 60 * 1000;
const EDIT_DELAY = 45 * 1000;
const IDLE_NEEDED = 8 * 1000;
const SNAPSHOT_EVERY = 60 * 60 * 1000;
const LOG_KEEP = 8;

const native = () => Capacitor.isNativePlatform();
const pickerWin = () => (typeof window !== 'undefined' ? (window as unknown as PickerWindow) : {});

/** Can this device keep a sync file and sync by itself? */
export const autoSyncSupported = () => native() || typeof pickerWin().showSaveFilePicker === 'function';

// ---------------------------------------------------------------- stored state (device-only, never in backups)

export async function getSyncPrefs(): Promise<SyncPrefs> {
  return { enabled: false, ...((await getMeta<SyncPrefs>('syncPrefs')) ?? {}) };
}
const setSyncPrefs = (p: SyncPrefs) => setMeta('syncPrefs', p);
const getPasscode = () => getMeta<string>('syncPasscode');

let status: SyncStatus = {};
const listeners = new Set<() => void>();
const notify = () => { for (const fn of listeners) { try { fn(); } catch { /* ignore */ } } };

/** Status changes (for the Grown-ups screen). */
export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!status.lastTry) status = { ...((await getMeta<SyncStatus>('syncStatus')) ?? {}), ...status };
  return status;
}
async function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  const { running: _r, ...keep } = status;
  void _r;
  await setMeta('syncStatus', keep).catch(() => {});
  notify();
}

export const getSyncLog = async () => (await getMeta<SyncLogEntry[]>('syncLog')) ?? [];
async function addLog(e: SyncLogEntry) {
  const log = [e, ...(await getSyncLog())].slice(0, LOG_KEEP);
  await setMeta('syncLog', log);
}

/** Record a manual (Send/Receive) sync in the recent-syncs list. */
export async function recordManualSync(summary: MergeSummary, devices: Record<string, DeviceInfo>) {
  await setMeta('syncDevices', mergeDevices(await getKnownDevices(), devices));
  await addLog({
    t: Date.now(), source: 'file', received: summary.received, sent: 0, added: summary.added, removed: summary.removed,
    conflicts: summary.conflicts.slice(0, 20),
  });
  notify();
}

/** This device's name, for files it writes. */
export const myDevices = () => myDeviceInfo();

/** Names other devices gave themselves (shown in merge summaries). */
export const getKnownDevices = async () => (await getMeta<Record<string, DeviceInfo>>('syncDevices')) ?? {};

function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  if (native()) return Math.min(screen.width, screen.height) >= 600 ? 'Android tablet' : 'Android phone';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return os ? `${br} on ${os}` : br;
}

export async function getDeviceName(): Promise<string> {
  return (await getMeta<string>('deviceName')) ?? guessDeviceName();
}
export async function setDeviceName(name: string) {
  const n = name.trim().slice(0, 40);
  await setMeta('deviceName', n || guessDeviceName());
  await setMeta('deviceNameT', Date.now());
  schedule(2000);
}

async function myDeviceInfo(): Promise<Record<string, DeviceInfo>> {
  const name = await getDeviceName();
  const t = (await getMeta<number>('deviceNameT')) ?? 1;
  return { [getDeviceId()]: { name, t } };
}

// ---------------------------------------------------------------- the file

class SyncError extends Error {
  constructor(message: string, public kind: 'reach' | 'permission' | 'passcode' | 'damaged' | 'newer' | 'verify' | 'other') { super(message); }
}

interface FileIO { read(): Promise<string>; write(text: string): Promise<void> }

/** The picked file for this session (also kept in IndexedDB so it survives a restart, where the browser allows). */
let memHandle: FileHandle | null = null;

async function fsHandle(interactive: boolean): Promise<FileHandle> {
  const h = memHandle ?? (await getMeta<FileHandle>('syncFileHandle'));
  if (!h) throw new SyncError('Choose the sync file again.', 'reach');
  let perm: PermissionState = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
  if (perm !== 'granted' && interactive && h.requestPermission) perm = await h.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new SyncError('Tap “Sync now” to let AACFree use the sync file again.', 'permission');
  return h;
}

function ioFor(target: SyncTarget, interactive: boolean): FileIO {
  if (target.kind === 'android') {
    return {
      read: async () => (await files().readDocument({ uri: target.uri })).text ?? '',
      write: (text) => writeAndroid(target.uri, text),
    };
  }
  return {
    read: async () => (await (await fsHandle(interactive)).getFile()).text(),
    write: async (text) => {
      // createWritable writes to a temporary copy and swaps it in on close: never a half-written file.
      const w = await (await fsHandle(interactive)).createWritable();
      await w.write(text);
      await w.close();
    },
  };
}

/** Android: send the file over the bridge in pieces; the document is only replaced once all of it arrived. */
async function writeAndroid(uri: string, text: string) {
  const blob = new Blob([text]);
  const CHUNK = 3 * 1024 * 1024; // a multiple of 3, so every base64 piece stands alone
  for (let off = 0, first = true; off < Math.max(1, blob.size); off += CHUNK, first = false) {
    const url = await blobToDataURL(blob.slice(off, off + CHUNK));
    await files().writeDocument({ uri, data: url.slice(url.indexOf(',') + 1), part: first ? 'begin' : 'append' });
  }
  const r = await files().writeDocument({ uri, data: '', part: 'commit' });
  if (typeof r?.bytes === 'number' && r.bytes !== blob.size) throw new SyncError('Couldn’t save the sync file. AACFree will try again.', 'verify');
}

const reach = async <T>(p: Promise<T>): Promise<T> => {
  try { return await p; } catch (e) {
    if (e instanceof SyncError) throw e;
    console.warn('sync file', e);
    throw new SyncError('Couldn’t reach the sync file.', 'reach');
  }
};

async function openText(text: string, passcode: string): Promise<OpenedSync | null> {
  if (!text.trim()) return null; // a brand-new, empty file
  let f;
  try { f = peekSyncFile(text); } catch { throw new SyncError('The sync file couldn’t be read.', 'damaged'); }
  try { return await openSyncFile(f, passcode); } catch (e) {
    const m = (e as Error).message ?? '';
    if (/newer version/.test(m)) throw new SyncError('Another device has a newer version of AACFree. Please update AACFree on this device.', 'newer');
    if (/Wrong passcode/.test(m)) throw new SyncError('The passcode doesn’t match the sync file.', 'passcode');
    throw new SyncError('The sync file couldn’t be read.', 'damaged');
  }
}

/** Android: create a new sync file with the system picker. Desktop: a "Save as" dialog. */
export async function chooseNewSyncFile(): Promise<{ target: SyncTarget; handle?: FileHandle } | null> {
  try {
    if (native()) {
      const r = await files().createDocument({ name: FILE_NAME });
      return { target: { kind: 'android', uri: r.uri, name: r.name } };
    }
    const w = pickerWin();
    if (!w.showSaveFilePicker) return null;
    const h = await w.showSaveFilePicker({ suggestedName: FILE_NAME, id: 'caleb-sync', types: [{ description: 'AACFree sync file', accept: { 'application/json': ['.json'] } }] });
    return { target: { kind: 'fs', name: h.name }, handle: h };
  } catch { return null; } // cancelled
}

/** Pick the sync file another device already made. */
export async function chooseExistingSyncFile(): Promise<{ target: SyncTarget; handle?: FileHandle } | null> {
  try {
    if (native()) {
      const r = await files().openDocument();
      return { target: { kind: 'android', uri: r.uri, name: r.name } };
    }
    const w = pickerWin();
    if (!w.showOpenFilePicker) return null;
    const [h] = await w.showOpenFilePicker({ id: 'caleb-sync', types: [{ description: 'AACFree sync file', accept: { 'application/json': ['.json'] } }] });
    if (h?.requestPermission) await h.requestPermission({ mode: 'readwrite' });
    return h ? { target: { kind: 'fs', name: h.name }, handle: h } : null;
  } catch { return null; }
}

/**
 * Turn automatic sync on with this file and passcode. Checks the passcode
 * against the file first (if it already holds data), then syncs once.
 */
export async function setupAutoSync(choice: { target: SyncTarget; handle?: FileHandle }, passcode: string): Promise<SyncLogEntry | null> {
  if (choice.handle) {
    memHandle = choice.handle;
    try { await setMeta('syncFileHandle', choice.handle); } catch { /* not storable here: works until AACFree restarts */ }
  }
  const io = ioFor(choice.target, true);
  const text = await reach(io.read());
  await openText(text, passcode); // throws on a wrong passcode or a damaged/other file
  await setMeta('syncPasscode', passcode);
  await setSyncPrefs({ enabled: true, target: choice.target });
  status = {};
  return runSync({ interactive: true, source: 'setup' });
}

/** Stop syncing on this device. The file and everything on this device stay as they are. */
export async function turnOffAutoSync() {
  await setSyncPrefs({ enabled: false });
  await setMeta('syncPasscode', undefined);
  await setMeta('syncFileHandle', undefined);
  memHandle = null;
  forgetKeys();
  status = {};
  await setMeta('syncStatus', {});
  notify();
}

// ---------------------------------------------------------------- one sync

let running: Promise<SyncLogEntry | null> | null = null;
let again = false;
let dirty = false;
let damagedSince = 0;
let lastInteraction = 0;
let lastSalt: string | undefined;

/** Read → merge → apply → write. Resolves with what happened (null if nothing ran). */
export async function runSync(opts: { interactive?: boolean; source?: SyncSource } = {}): Promise<SyncLogEntry | null> {
  while (running) {
    // A background sync joins the one in progress; "Sync now" and setup wait for it, then run their own.
    if (!opts.interactive) { again = true; return running; }
    await running.catch(() => null);
  }
  const p = doSync(opts.interactive ?? false, opts.source ?? 'auto').finally(() => {
    running = null;
    if (again) { again = false; schedule(1000); }
  });
  running = p;
  return p;
}

/** Sync from "Sync now". */
export const syncNow = () => runSync({ interactive: true, source: 'now' });

function busyTalking(): boolean {
  const st = useStore.getState();
  return st.editMode || Date.now() - lastInteraction < IDLE_NEEDED;
}

async function snapshotBeforeApplying(data: AppData, summary: MergeSummary) {
  const last = (await getMeta<number>('lastSyncSnapshot')) ?? 0;
  if (summary.conflicts.length || summary.removed.length || Date.now() - last > SNAPSHOT_EVERY) {
    await addSnapshot(data, 'Before syncing from another device');
    await setMeta('lastSyncSnapshot', Date.now());
  }
}

async function doSync(interactive: boolean, source: SyncSource): Promise<SyncLogEntry | null> {
  const prefs = await getSyncPrefs();
  if (!prefs.enabled || !prefs.target) return null;
  // Saved boards that couldn't be opened: the screen shows a placeholder, which must never reach the family's file.
  if (!useStore.getState().loaded || useStore.getState().loadProblem) return null;
  if (!interactive && busyTalking()) { schedule(15_000); return null; }
  const passcode = await getPasscode();
  if (!passcode) { await setStatus({ error: 'Enter the sync passcode again.', lastTry: Date.now() }); return null; }
  await setStatus({ running: true, lastTry: Date.now() });
  const io = ioFor(prefs.target, interactive);
  const wasDirty = dirty;
  dirty = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const text = await reach(io.read());
      let remote: OpenedSync | null;
      try {
        remote = await openText(text, passcode);
        damagedSince = 0;
      } catch (e) {
        if (!(e instanceof SyncError) || e.kind !== 'damaged') throw e;
        // A half-written or damaged file. Every device still has all its data, so rewriting is safe,
        // but give a writer in progress a few minutes first.
        if (!damagedSince) damagedSince = Date.now();
        if (!interactive && Date.now() - damagedSince < 10 * 60 * 1000) throw new SyncError('The sync file couldn’t be read. AACFree will try again.', 'damaged');
        await setMeta('syncPrevFile', text).catch(() => {});
        remote = null;
      }
      if (remote) lastSalt = remote.salt;
      const known = mergeDevices(await getKnownDevices(), remote?.devices ?? {});
      const mine = await myDeviceInfo();
      const devices = mergeDevices(known, mine);
      await setMeta('syncDevices', devices);

      // Apply what's new here.
      let summary: MergeSummary | null = null;
      if (remote) {
        const probe = mergeData(useStore.getState().data, remote.data);
        if (probe.summary.localChanged) {
          if (!interactive && busyTalking()) { schedule(15_000); dirty ||= wasDirty; await setStatus({ running: false }); return null; }
          await snapshotBeforeApplying(useStore.getState().data, probe.summary);
          // Merge again with the very latest local state (an edit may have landed while snapshotting).
          const r = mergeData(useStore.getState().data, remote.data);
          applySyncedData(r.data);
          summary = r.summary;
        } else summary = probe.summary;
      }
      const devicesChanged = !remote || Object.entries(mine).some(([id, v]) => remote!.devices[id]?.name !== v.name);
      const needWrite = !remote || remote.legacy || summary!.remoteChanged || devicesChanged;
      if (needWrite) {
        // Someone else wrote meanwhile? Then merge their version first.
        const check = await reach(io.read());
        if (check !== text) continue;
        const { text: out } = await buildSyncText(useStore.getState().data, passcode, { devices, salt: lastSalt });
        if (text.trim()) await setMeta('syncPrevFile', text).catch(() => {});
        await writeVerified(io, out);
      }
      const entry: SyncLogEntry = {
        t: Date.now(), source,
        received: summary?.received ?? {}, sent: summary ? summary.sent : 0,
        added: summary?.added ?? [], removed: summary?.removed ?? [], conflicts: (summary?.conflicts ?? []).slice(0, 20),
      };
      if (summary && (totalReceived(summary) || summary.sent || summary.added.length || summary.removed.length || summary.conflicts.length)) await addLog(entry);
      await setStatus({ running: false, lastOk: Date.now(), error: undefined });
      return entry;
    }
    throw new SyncError('Another device kept writing the sync file. AACFree will try again.', 'other');
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError('Couldn’t sync. AACFree will try again.', 'other');
    if (!(e instanceof SyncError)) console.warn('sync failed', e);
    dirty ||= wasDirty;
    await setStatus({ running: false, error: err.message });
    if (interactive) throw err;
    return null;
  }
}

async function writeVerified(io: FileIO, text: string) {
  for (let i = 0; i < 2; i++) {
    await reach(io.write(text));
    let back = '';
    try { back = await io.read(); } catch { /* fall through to retry */ }
    if (back.startsWith(text)) return;
  }
  throw new SyncError('Couldn’t save the sync file. AACFree will try again.', 'verify');
}

// ---------------------------------------------------------------- when to sync

let timer: ReturnType<typeof setTimeout> | undefined;
let timerAt = 0;
/** Run a background sync in `ms` (an earlier pending one wins). */
function schedule(ms: number) {
  const at = Date.now() + ms;
  if (timer && timerAt <= at) return;
  if (timer) clearTimeout(timer);
  timerAt = at;
  timer = setTimeout(() => { timer = undefined; runSync().catch(() => {}); }, ms);
}

let started = false;
/** Wire up the triggers (called once after AACFree has loaded). */
export function startAutoSync() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const touch = () => { lastInteraction = Date.now(); };
  window.addEventListener('pointerdown', touch, { capture: true, passive: true });
  window.addEventListener('keydown', touch, { capture: true, passive: true });
  onContentChange(() => { dirty = true; schedule(EDIT_DELAY); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - (status.lastTry ?? 0) > 20_000) schedule(1500);
    } else if (dirty) {
      // Leaving the app with unsynced edits: try now (best effort, nobody is tapping).
      lastInteraction = 0;
      runSync().catch(() => {});
    }
  });
  setInterval(() => { if (document.visibilityState === 'visible') schedule(0); }, INTERVAL);
  schedule(0);
}
