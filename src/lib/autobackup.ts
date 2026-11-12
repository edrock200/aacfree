import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { AppData } from '../types';
import { createBackup } from './backup';
import { getMeta, setMeta } from './db';

/**
 * Weekly automatic backup to a place that survives losing the app:
 *  - Android: Documents/Caleb/ on the device (kept even if Caleb is uninstalled;
 *    Google Drive / Files can sync that folder).
 *  - Web (Chrome/Edge desktop): a folder the family chooses once.
 * The previous copy is kept as "…-previous.json".
 */

const WEEK = 7 * 24 * 3600 * 1000;
const NAME = 'caleb-auto-backup.json';
const PREV = 'caleb-auto-backup-previous.json';

export interface AutoBackupStatus { t: number; where: string; error?: string }

type DirHandle = {
  name: string;
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(n: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>; getFile(): Promise<File> }>;
};

export const folderPickerSupported = () => !Capacitor.isNativePlatform() && 'showDirectoryPicker' in window;

export async function chooseBackupFolder(): Promise<string | null> {
  if (!folderPickerSupported()) return null;
  const handle = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ mode: 'readwrite', id: 'caleb-backups' });
  await setMeta('backupFolder', handle);
  return handle.name;
}

export async function backupFolderName(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) return 'Documents/Caleb';
  const h = await getMeta<DirHandle>('backupFolder');
  return h?.name ?? null;
}

export const lastAutoBackup = () => getMeta<AutoBackupStatus>('autoBackup');

/** Run if a week has passed (or when forced). `interactive` may ask for folder permission (needs a click). */
export async function runAutoBackup(data: AppData, opts: { force?: boolean; interactive?: boolean } = {}): Promise<AutoBackupStatus | null> {
  const last = await lastAutoBackup();
  if (!opts.force && last && !last.error && Date.now() - last.t < WEEK) return null;
  const blob = await createBackup(data);
  let status: AutoBackupStatus;
  try {
    if (Capacitor.isNativePlatform()) {
      const text = await blob.text();
      const dir = Directory.Documents;
      await Filesystem.requestPermissions().catch(() => {}); // only prompts on Android 10 and older
      try { await Filesystem.copy({ from: `Caleb/${NAME}`, to: `Caleb/${PREV}`, directory: dir, toDirectory: dir }); } catch { /* first backup */ }
      await Filesystem.writeFile({ path: `Caleb/${NAME}`, data: text, directory: dir, encoding: Encoding.UTF8, recursive: true });
      status = { t: Date.now(), where: `Documents/Caleb/${NAME}` };
    } else {
      const h = await getMeta<DirHandle>('backupFolder');
      if (!h) return null;
      let perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && opts.interactive) perm = await h.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        status = { t: last?.t ?? 0, where: h.name, error: 'Needs permission — tap “Back up now”.' };
        await setMeta('autoBackup', status);
        return status;
      }
      try {
        const old = await (await h.getFileHandle(NAME)).getFile();
        const w0 = await (await h.getFileHandle(PREV, { create: true })).createWritable();
        await w0.write(old);
        await w0.close();
      } catch { /* first backup */ }
      const w = await (await h.getFileHandle(NAME, { create: true })).createWritable();
      await w.write(blob);
      await w.close();
      status = { t: Date.now(), where: `${h.name}/${NAME}` };
    }
  } catch (e) {
    console.warn('auto backup failed', e);
    status = { t: last?.t ?? 0, where: last?.where ?? '', error: 'Could not write the backup file.' };
  }
  await setMeta('autoBackup', status);
  return status;
}
