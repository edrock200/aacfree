import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { AppData } from '../types';
import { createBackup } from './backup';
import { getMeta, setMeta } from './db';

/**
 * Automatic backups that survive losing the app or the device.
 *  - Android: dated files in Documents/Caleb on the device (kept after uninstall),
 *    plus optionally one file in any storage provider the family picks
 *    (Google Drive, OneDrive, Dropbox, SD card…) via the system file picker.
 *  - Web (Chrome/Edge desktop): dated files in a folder the family chooses.
 * Frequency, number of copies, contents and encryption are configurable.
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

export const DEFAULT_PREFS: BackupPrefs = {
  enabled: true, frequency: 'weekly', keep: 4, includeMedia: true, includeHistory: true, encrypt: false,
};

export interface AutoBackupStatus { t: number; where: string; error?: string }

export interface SavedBackup { name: string; t: number; source: 'device' | 'folder' | 'cloud'; read: () => Promise<string> }

interface CalebFilesPlugin {
  createDocument(o: { name: string }): Promise<{ uri: string; name: string }>;
  openDocument(): Promise<{ uri: string; name: string }>;
  writeDocument(o: { uri: string; text: string }): Promise<void>;
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

const DAY = 24 * 3600 * 1000;
const PERIOD: Record<Frequency, number> = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY };
const DIR = 'Caleb';
const native = () => Capacitor.isNativePlatform();
const FILE_RE = /^caleb-(?:auto-)?backup-(\d{4}-\d{2}-\d{2})(?:[-_](\d{4}))?\.json$/;

export const folderPickerSupported = () => !native() && 'showDirectoryPicker' in window;
export const cloudFileSupported = () => native();

export async function getPrefs(): Promise<BackupPrefs> {
  const p = await getMeta<Partial<BackupPrefs>>('backupPrefs');
  return { ...DEFAULT_PREFS, ...(p ?? {}) };
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
  const r = await CalebFiles.createDocument({ name: 'caleb-backup.json' });
  await setPrefs({ cloudUri: r.uri, cloudName: r.name });
  return r.name;
}
export async function forgetCloudFile() { await setPrefs({ cloudUri: undefined, cloudName: undefined }); }

export async function backupFolderName(): Promise<string | null> {
  if (native()) return 'Documents/Caleb';
  const h = await getMeta<DirHandle>('backupFolder');
  return h?.name ?? null;
}

export const lastAutoBackup = () => getMeta<AutoBackupStatus>('autoBackup');

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
const timeOf = (name: string) => {
  const m = FILE_RE.exec(name);
  if (!m) return 0;
  const [y, mo, d] = m[1].split('-').map(Number);
  const hm = m[2] ?? '0000';
  return new Date(y, mo - 1, d, Number(hm.slice(0, 2)), Number(hm.slice(2))).getTime();
};

/** Make a backup now if it's due (or `force`). `interactive` may ask for folder permission. */
export async function runAutoBackup(data: AppData, opts: { force?: boolean; interactive?: boolean } = {}): Promise<AutoBackupStatus | null> {
  const prefs = await getPrefs();
  const last = await lastAutoBackup();
  if (!opts.force) {
    if (!prefs.enabled) return null;
    if (last && !last.error && Date.now() - last.t < PERIOD[prefs.frequency]) return null;
  }
  const passcode = prefs.encrypt ? await getBackupPasscode() : undefined;
  if (prefs.encrypt && !passcode) {
    const s = { t: last?.t ?? 0, where: last?.where ?? '', error: 'Set a backup passcode first.' };
    await setMeta('autoBackup', s);
    return s;
  }
  const blob = await createBackup(data, { includeMedia: prefs.includeMedia, includeHistory: prefs.includeHistory, passcode });
  const text = await blob.text();
  const name = `caleb-backup-${stamp()}.json`;
  const places: string[] = [];
  const errors: string[] = [];

  if (native()) {
    try {
      await Filesystem.requestPermissions().catch(() => {}); // only prompts on Android 10 and older
      await Filesystem.writeFile({ path: `${DIR}/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      places.push(`Documents/Caleb/${name}`);
      await rotateDevice(prefs.keep);
    } catch (e) {
      console.warn('device backup failed', e);
      errors.push('Could not write the backup file.');
    }
    if (prefs.cloudUri) {
      try {
        await CalebFiles.writeDocument({ uri: prefs.cloudUri, text });
        places.push(prefs.cloudName ?? 'cloud file');
      } catch (e) {
        console.warn('cloud backup failed', e);
        errors.push('Could not update the cloud backup file — choose it again.');
      }
    }
  } else {
    const h = await getMeta<DirHandle>('backupFolder');
    if (!h) return null;
    let perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && opts.interactive) perm = await h.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const s = { t: last?.t ?? 0, where: h.name, error: 'Needs permission — tap “Back up now”.' };
      await setMeta('autoBackup', s);
      return s;
    }
    try {
      const w = await (await h.getFileHandle(name, { create: true })).createWritable();
      await w.write(text);
      await w.close();
      places.push(`${h.name}/${name}`);
      await rotateFolder(h, prefs.keep);
    } catch (e) {
      console.warn('folder backup failed', e);
      errors.push('Could not write the backup file.');
    }
  }
  const status: AutoBackupStatus = places.length
    ? { t: Date.now(), where: places.join(' + '), error: errors[0] }
    : { t: last?.t ?? 0, where: last?.where ?? '', error: errors[0] ?? 'Could not write the backup file.' };
  await setMeta('autoBackup', status);
  return status;
}

async function rotateDevice(keep: number) {
  const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Documents });
  const ours = files.map((f) => f.name).filter((n) => FILE_RE.test(n)).sort((a, b) => timeOf(b) - timeOf(a));
  for (const n of ours.slice(Math.max(1, keep))) await Filesystem.deleteFile({ path: `${DIR}/${n}`, directory: Directory.Documents }).catch(() => {});
}

async function rotateFolder(h: DirHandle, keep: number) {
  const names: string[] = [];
  for await (const [n, e] of h.entries()) if (e.kind === 'file' && FILE_RE.test(n)) names.push(n);
  names.sort((a, b) => timeOf(b) - timeOf(a));
  for (const n of names.slice(Math.max(1, keep))) await h.removeEntry(n).catch(() => {});
}

/** All automatic backups Caleb can see, newest first (for "Restore an automatic backup"). */
export async function listSavedBackups(): Promise<SavedBackup[]> {
  const out: SavedBackup[] = [];
  if (native()) {
    try {
      const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Documents });
      for (const f of files) {
        if (!FILE_RE.test(f.name)) continue;
        out.push({
          name: f.name, t: timeOf(f.name), source: 'device',
          read: async () => (await Filesystem.readFile({ path: `${DIR}/${f.name}`, directory: Directory.Documents, encoding: Encoding.UTF8 })).data as string,
        });
      }
    } catch { /* no folder yet */ }
    const prefs = await getPrefs();
    if (prefs.cloudUri) {
      const uri = prefs.cloudUri;
      out.push({ name: prefs.cloudName ?? 'cloud file', t: 0, source: 'cloud', read: async () => (await CalebFiles.readDocument({ uri })).text });
    }
  } else {
    const h = await getMeta<DirHandle>('backupFolder');
    if (h && (await h.queryPermission({ mode: 'readwrite' })) === 'granted') {
      for await (const [n, e] of h.entries()) {
        if (e.kind !== 'file' || !FILE_RE.test(n)) continue;
        out.push({ name: n, t: timeOf(n), source: 'folder', read: async () => (await (await h.getFileHandle(n)).getFile()).text() });
      }
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

/** Android: open any backup file from a storage provider (e.g. a backup in Google Drive). */
export async function openCloudBackup(): Promise<string | null> {
  if (!native()) return null;
  const r = await CalebFiles.openDocument();
  return (await CalebFiles.readDocument({ uri: r.uri })).text;
}
