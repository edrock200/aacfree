import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { AppData } from '../types';
import { createBackup } from './backup';
import { getMeta, setMeta, storedWritesBlocked } from './db';
import { blobToDataURL } from './util';
import { hasUserContent } from './validate';

/**
 * Automatic backups that survive losing the app or the device.
 *  - Android: dated files in Documents/AACFree on the device. The files stay after
 *    the app is removed, but after a reinstall on Android 11 and newer AACFree can
 *    no longer list them (they belong to the old install), so the restore list
 *    offers the system file picker, which can still open them.
 *    Optionally also one file in any storage provider the family picks
 *    (Google Drive, OneDrive, Dropbox, SD card…) via the system file picker.
 *  - Web (Chrome/Edge desktop): dated files in a folder the family chooses.
 * Frequency, number of copies, contents and encryption are configurable.
 * Background runs never ask for anything (no permission prompts mid-talk).
 */

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface BackupPrefs {
  enabled: boolean;
  frequency: Frequency;
  /** How many dated copies to keep in the device/web folder. */
  keep: number;
  includeMedia: boolean;
  includeHistory: boolean;
  /** Lock backup files with the device-only passcode. */
  encrypt: boolean;
  /** Android: a file in a cloud/storage provider chosen with the system picker. */
  cloudUri?: string;
  cloudName?: string;
}

/**
 * Recent sentences and learned words stay out of backup files unless the
 * family turns them on (new installs; saved choices are kept).
 */
export const DEFAULT_PREFS: BackupPrefs = {
  enabled: true, frequency: 'weekly', keep: 4, includeMedia: true, includeHistory: false, encrypt: false,
};

export type Destination = 'device' | 'folder' | 'cloud';

/** Result of the last attempt for one destination. */
export interface DestStatus {
  /** Last successful backup. */
  ok: number;
  /** Last attempt (successful or not). */
  tried: number;
  error?: string;
  where?: string;
}

export interface AutoBackupStatus {
  t: number;
  where: string;
  error?: string;
  /** Per destination, so a failing one is retried on its own and a working one is not redone. */
  dest?: Partial<Record<Destination, DestStatus>>;
}

export interface SavedBackup { name: string; t: number; source: 'device' | 'folder' | 'cloud'; read: () => Promise<string> }

interface CalebFilesPlugin {
  createDocument(o: { name: string }): Promise<{ uri: string; name: string }>;
  openDocument(): Promise<{ uri: string; name: string }>;
  /**
   * Without `part`: overwrites the document with `text` (or base64 `data`).
   * With `part`: 'begin' / 'append' collect base64 chunks in a private temp file;
   * 'commit' copies it into the document in one go. Both modes read the
   * document back and reject unless every byte arrived. Resolves the size written.
   */
  writeDocument(o: { uri: string; text?: string; data?: string; part?: 'begin' | 'append' | 'commit' }): Promise<{ bytes?: number }>;
  readDocument(o: { uri: string }): Promise<{ text: string }>;
}
const CalebFiles = registerPlugin<CalebFilesPlugin>('CalebFiles');

type FileHandle = { createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }>; getFile(): Promise<File> };
type DirHandle = {
  name: string;
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(n: string, o?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(n: string): Promise<void>;
  entries(): AsyncIterable<[string, { kind: string }]>;
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const PERIOD: Record<Frequency, number> = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY };
/** A destination that failed is tried again after this long (not on every launch). */
const RETRY_AFTER = 6 * HOUR;
/** Bytes per chunk sent over the Android bridge (a multiple of 3, so every base64 piece stands alone). */
const CHUNK = 3 * 1024 * 1024;
/** Automatic backups go to Documents/AACFree; copies made before the rename (Documents/Caleb) are still listed and restorable. */
const DIR = 'AACFree';
const OLD_DIR = 'Caleb';
const native = () => Capacitor.isNativePlatform();
const FILE_RE = /^(?:aacfree|caleb)-(?:auto-)?backup-(\d{4}-\d{2}-\d{2})(?:[-_](\d{4}))?\.json$/;

export const folderPickerSupported = () => !native() && 'showDirectoryPicker' in window;
export const cloudFileSupported = () => native();

const FREQS: Frequency[] = ['daily', 'weekly', 'monthly'];

export async function getPrefs(): Promise<BackupPrefs> {
  const p = await getMeta<Partial<BackupPrefs>>('backupPrefs');
  const out = { ...DEFAULT_PREFS, ...(p && typeof p === 'object' ? p : {}) };
  if (!FREQS.includes(out.frequency)) out.frequency = DEFAULT_PREFS.frequency;
  out.keep = Number.isFinite(out.keep) ? Math.min(30, Math.max(1, Math.round(out.keep))) : DEFAULT_PREFS.keep;
  return out;
}
export async function setPrefs(patch: Partial<BackupPrefs>): Promise<BackupPrefs> {
  const next = { ...(await getPrefs()), ...patch };
  await setMeta('backupPrefs', next);
  return next;
}

/** The backup passcode lives only on this device (never inside backups or sync files). */
export const getBackupPasscode = () => getMeta<string>('backupPasscode');
export const setBackupPasscode = (p: string | undefined) => setMeta('backupPasscode', p);

export async function chooseBackupFolder(): Promise<string | null> {
  if (!folderPickerSupported()) return null;
  const handle = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ mode: 'readwrite', id: 'caleb-backups' });
  await setMeta('backupFolder', handle);
  return handle.name;
}

/** Android: pick (create) a file in Google Drive / OneDrive / Dropbox / SD card. */
export async function chooseCloudFile(): Promise<string | null> {
  if (!cloudFileSupported()) return null;
  const r = await CalebFiles.createDocument({ name: 'aacfree-backup.json' });
  await setPrefs({ cloudUri: r.uri, cloudName: r.name });
  return r.name;
}
export async function forgetCloudFile() { await setPrefs({ cloudUri: undefined, cloudName: undefined }); }

export async function backupFolderName(): Promise<string | null> {
  if (native()) return 'Documents/AACFree';
  const h = await getMeta<DirHandle>('backupFolder');
  return h?.name ?? null;
}

export const lastAutoBackup = () => getMeta<AutoBackupStatus>('autoBackup');

/**
 * Android 10 and older need a storage permission for Documents/AACFree. Asking
 * only happens when a grown-up taps something in the Backup panel.
 */
export async function hasStoragePermission(): Promise<boolean> {
  if (!native()) return true;
  try { return (await Filesystem.checkPermissions()).publicStorage === 'granted'; } catch { return true; }
}
export async function askStoragePermission(): Promise<boolean> {
  if (!native()) return true;
  try { return (await Filesystem.requestPermissions()).publicStorage === 'granted'; } catch { return false; }
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
export const timeOf = (name: string) => {
  const m = FILE_RE.exec(name);
  if (!m) return 0;
  const [y, mo, d] = m[1].split('-').map(Number);
  const hm = m[2] ?? '0000';
  return new Date(y, mo - 1, d, Number(hm.slice(0, 2)), Number(hm.slice(2))).getTime();
};

/**
 * Which dated copies to delete. Keeps the newest `keep` copies, but copies
 * made close together (less than half a backup period apart, e.g. several
 * retries or "Back up now" taps) count as one: only the newest of them is
 * kept, so they never push out the older weekly or monthly copies.
 */
export function filesToDelete(names: string[], keep: number, periodMs: number): string[] {
  const files = names.filter((n) => FILE_RE.test(n)).map((n) => ({ n, t: timeOf(n) })).sort((a, b) => b.t - a.t);
  const kept: { n: string; t: number }[] = [];
  const del: string[] = [];
  for (const f of files) {
    const prev = kept[kept.length - 1];
    if (kept.length >= Math.max(1, keep) || (prev && prev.t - f.t < periodMs / 2)) del.push(f.n);
    else kept.push(f);
  }
  return del;
}

/** Old single-status records (before per-destination tracking) count as a success for the destination they wrote. */
function destStatus(last: AutoBackupStatus | undefined, d: Destination): DestStatus | undefined {
  if (last?.dest?.[d]) return last.dest[d];
  if (last && !last.dest && !last.error && last.t && d !== 'cloud') return { ok: last.t, tried: last.t };
  return undefined;
}

export function isDue(s: DestStatus | undefined, periodMs: number, now = Date.now()): boolean {
  if (!s) return true;
  if (now - s.ok < periodMs && s.ok <= now) return false;
  return !s.error || now - s.tried >= RETRY_AFTER || s.tried > now;
}

const BLOCKED = 'Your saved boards could not be opened, so nothing was backed up.';
const NEEDS_PERMISSION = 'Needs permission — tap “Back up now”.';
const WRITE_FAILED = 'Could not write the backup file.';
const VERIFY_FAILED = 'The backup file could not be checked, so it was not kept. Try again.';
const CLOUD_FAILED = 'Could not update the cloud backup file — choose it again.';

/** Base64 pieces of a blob, CHUNK bytes each (at least one, even for an empty blob). */
async function* base64Chunks(blob: Blob): AsyncGenerator<string> {
  for (let off = 0; off < Math.max(1, blob.size); off += CHUNK) {
    const url = await blobToDataURL(blob.slice(off, off + CHUNK));
    yield url.slice(url.indexOf(',') + 1);
  }
}

/** Android: write Documents/AACFree/<name> in chunks to a temporary name, check its size, then rename. */
async function writeDeviceFile(name: string, blob: Blob) {
  const tmp = `${DIR}/${name}.part`;
  let first = true;
  for await (const data of base64Chunks(blob)) {
    if (first) await Filesystem.writeFile({ path: tmp, data, directory: Directory.Documents, recursive: true });
    else await Filesystem.appendFile({ path: tmp, data, directory: Directory.Documents });
    first = false;
  }
  const st = await Filesystem.stat({ path: tmp, directory: Directory.Documents });
  if (st.size !== blob.size) {
    await Filesystem.deleteFile({ path: tmp, directory: Directory.Documents }).catch(() => {});
    throw new Error(VERIFY_FAILED);
  }
  await Filesystem.deleteFile({ path: `${DIR}/${name}`, directory: Directory.Documents }).catch(() => {});
  await Filesystem.rename({ from: tmp, to: `${DIR}/${name}`, directory: Directory.Documents, toDirectory: Directory.Documents });
}

/** Android: replace the cloud file only once every chunk has crossed the bridge, then check it. */
async function writeCloudFile(uri: string, blob: Blob) {
  let first = true;
  for await (const data of base64Chunks(blob)) {
    await CalebFiles.writeDocument({ uri, data, part: first ? 'begin' : 'append' });
    first = false;
  }
  const r = await CalebFiles.writeDocument({ uri, data: '', part: 'commit' });
  if (typeof r?.bytes === 'number' && r.bytes !== blob.size) throw new Error(VERIFY_FAILED);
}

async function writeFolderFile(h: DirHandle, name: string, blob: Blob) {
  const fh = await h.getFileHandle(name, { create: true });
  const w = await fh.createWritable(); // writes go to a swap file until close()
  await w.write(blob);
  await w.close();
  if ((await fh.getFile()).size !== blob.size) {
    await h.removeEntry(name).catch(() => {});
    throw new Error(VERIFY_FAILED);
  }
}

/**
 * Make a backup now if it's due (or `force`). `interactive` (a grown-up tapped
 * a button) may ask for storage or folder permission; background runs never do.
 * Never runs on placeholder data, and never replaces a backup with the
 * untouched default unless forced.
 */
export async function runAutoBackup(data: AppData, opts: { force?: boolean; interactive?: boolean } = {}): Promise<AutoBackupStatus | null> {
  const last = await lastAutoBackup();
  if (storedWritesBlocked()) {
    if (!opts.force) return null;
    return { ...(last ?? { t: 0, where: '' }), error: BLOCKED };
  }
  const prefs = await getPrefs();
  if (!opts.force && (!prefs.enabled || !hasUserContent(data))) return null;
  const period = PERIOD[prefs.frequency];
  const now = Date.now();

  const targets: Destination[] = [];
  const h = native() ? undefined : await getMeta<DirHandle>('backupFolder');
  if (native()) {
    targets.push('device');
    if (prefs.cloudUri) targets.push('cloud');
  } else if (h) {
    targets.push('folder');
  }
  if (!targets.length) return null;
  const due = opts.force ? targets : targets.filter((d) => isDue(destStatus(last, d), period, now));
  if (!due.length) return null;

  const dest: Partial<Record<Destination, DestStatus>> = {};
  for (const d of targets) { const s = destStatus(last, d); if (s) dest[d] = s; }
  const fail = (d: Destination, error: string) => { dest[d] = { ...(dest[d] ?? { ok: 0 }), tried: now, error }; };
  const succeed = (d: Destination, where: string) => { dest[d] = { ok: now, tried: now, where }; };

  const passcode = prefs.encrypt ? await getBackupPasscode() : undefined;
  if (prefs.encrypt && !passcode) {
    for (const d of due) fail(d, 'Set a backup passcode first.');
    return saveStatus(last, dest, due);
  }
  const blob = await createBackup(data, { includeMedia: prefs.includeMedia, includeHistory: prefs.includeHistory, passcode });
  const name = `aacfree-backup-${stamp()}.json`;

  if (due.includes('device')) {
    const allowed = (await hasStoragePermission()) || (opts.interactive ? await askStoragePermission() : false);
    if (!allowed) fail('device', NEEDS_PERMISSION);
    else {
      try {
        await writeDeviceFile(name, blob);
        succeed('device', `Documents/AACFree/${name}`);
        await rotateDevice(prefs.keep, period).catch((e) => console.warn('rotation failed', e));
      } catch (e) {
        console.warn('device backup failed', e);
        fail('device', (e as Error)?.message === VERIFY_FAILED ? VERIFY_FAILED : WRITE_FAILED);
      }
    }
  }
  if (due.includes('cloud') && prefs.cloudUri) {
    try {
      await writeCloudFile(prefs.cloudUri, blob);
      succeed('cloud', prefs.cloudName ?? 'cloud file');
    } catch (e) {
      console.warn('cloud backup failed', e);
      fail('cloud', /verify/i.test(String((e as Error)?.message)) || (e as Error)?.message === VERIFY_FAILED ? VERIFY_FAILED : CLOUD_FAILED);
    }
  }
  if (due.includes('folder') && h) {
    let perm = await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState);
    if (perm !== 'granted' && opts.interactive) perm = await h.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState);
    if (perm !== 'granted') fail('folder', NEEDS_PERMISSION);
    else {
      try {
        await writeFolderFile(h, name, blob);
        succeed('folder', `${h.name}/${name}`);
        await rotateFolder(h, prefs.keep, period).catch((e) => console.warn('rotation failed', e));
      } catch (e) {
        console.warn('folder backup failed', e);
        fail('folder', (e as Error)?.message === VERIFY_FAILED ? VERIFY_FAILED : WRITE_FAILED);
      }
    }
  }
  return saveStatus(last, dest, due);
}

async function saveStatus(last: AutoBackupStatus | undefined, dest: Partial<Record<Destination, DestStatus>>, due: Destination[]): Promise<AutoBackupStatus> {
  const all = Object.values(dest).filter((s): s is DestStatus => !!s);
  const newest = all.reduce((m, s) => Math.max(m, s.ok), 0);
  const where = all.filter((s) => s.ok === newest && s.where).map((s) => s.where).join(' + ');
  const error = due.map((d) => dest[d]?.error).find(Boolean);
  const status: AutoBackupStatus = { t: newest || last?.t || 0, where: where || last?.where || '', dest };
  if (error) status.error = error;
  await setMeta('autoBackup', status);
  return status;
}

async function rotateDevice(keep: number, period: number) {
  const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Documents });
  const names = files.map((f) => f.name);
  // Leftovers of interrupted writes.
  const partial = names.filter((n) => n.endsWith('.json.part') && FILE_RE.test(n.slice(0, -5)));
  for (const n of [...partial, ...filesToDelete(names, keep, period)]) {
    await Filesystem.deleteFile({ path: `${DIR}/${n}`, directory: Directory.Documents }).catch(() => {});
  }
}

export async function rotateFolder(h: Pick<DirHandle, 'entries' | 'removeEntry'>, keep: number, period: number) {
  const names: string[] = [];
  for await (const [n, e] of h.entries()) if (e.kind === 'file' && FILE_RE.test(n)) names.push(n);
  for (const n of filesToDelete(names, keep, period)) await h.removeEntry(n).catch(() => {});
}

/** All automatic backups AACFree can see, newest first (for "Restore an automatic backup"). */
export async function listSavedBackups(opts: { interactive?: boolean } = {}): Promise<SavedBackup[]> {
  const out: SavedBackup[] = [];
  if (native()) {
    try {
      if ((await hasStoragePermission()) || (opts.interactive && (await askStoragePermission()))) {
        for (const dir of [DIR, OLD_DIR]) {
          let files: { name: string }[] = [];
          try { ({ files } = await Filesystem.readdir({ path: dir, directory: Directory.Documents })); } catch { continue; /* no folder */ }
          for (const f of files) {
            if (!FILE_RE.test(f.name)) continue;
            out.push({
              name: f.name, t: timeOf(f.name), source: 'device',
              read: async () => (await Filesystem.readFile({ path: `${dir}/${f.name}`, directory: Directory.Documents, encoding: Encoding.UTF8 })).data as string,
            });
          }
        }
      }
    } catch { /* no folder yet */ }
    const prefs = await getPrefs();
    if (prefs.cloudUri) {
      const uri = prefs.cloudUri;
      out.push({ name: prefs.cloudName ?? 'cloud file', t: 0, source: 'cloud', read: async () => (await CalebFiles.readDocument({ uri })).text });
    }
  } else {
    const h = await getMeta<DirHandle>('backupFolder');
    let perm = h ? await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState) : 'denied';
    if (h && perm !== 'granted' && opts.interactive) perm = await h.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState);
    if (h && perm === 'granted') {
      for await (const [n, e] of h.entries()) {
        if (e.kind !== 'file' || !FILE_RE.test(n)) continue;
        out.push({ name: n, t: timeOf(n), source: 'folder', read: async () => (await (await h.getFileHandle(n)).getFile()).text() });
      }
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

/** Android: open any backup file from a storage provider (e.g. a backup in Google Drive, or Documents/AACFree after a reinstall). */
export async function openCloudBackup(): Promise<string | null> {
  if (!native()) return null;
  const r = await CalebFiles.openDocument();
  return (await CalebFiles.readDocument({ uri: r.uri })).text;
}
