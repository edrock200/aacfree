import type { AppData } from '../types';
import { migrate } from '../store';
import { allAssetIds, getAsset, putAsset } from './db';
import { blobToDataURL, dataURLToBlob } from './util';
import { seal, unseal } from './crypto';
import { withoutTransient } from './validate';
import { withoutPin } from './lock';

export interface BackupFile {
  app: 'caleb';
  kind: 'backup';
  version: number;
  exportedAt: string;
  data: AppData;
  assets: Record<string, string>; // id → data URL
}

/** Asset ids referenced anywhere in the data (images `img:…` and audio ids). */
export function referencedAssets(data: unknown): Set<string> {
  const json = JSON.stringify(data);
  const ids = new Set<string>();
  for (const m of json.matchAll(/"img:([^"]+)"/g)) ids.add(m[1]);
  for (const m of json.matchAll(/"audio":"([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

export interface BackupOptions {
  /** Include photos and recorded voices (default true). */
  includeMedia?: boolean;
  /** Include spoken-message history and learned words (default true). */
  includeHistory?: boolean;
  /** Encrypt the whole file with this passcode (plain files never carry the grown-up PIN). */
  passcode?: string;
}

export async function createBackup(input: AppData, opts: BackupOptions = {}): Promise<Blob> {
  let data = withoutTransient(input);
  if (!opts.passcode) data = withoutPin(data);
  if (opts.includeHistory === false) {
    data = { ...data, profiles: data.profiles.map((p) => ({ ...p, history: [], lexicon: {} })) };
  }
  const refs = opts.includeMedia === false ? new Set<string>() : referencedAssets(data);
  const existing = new Set(await allAssetIds());
  const assets: Record<string, string> = {};
  for (const id of refs) {
    if (!existing.has(id)) continue;
    const b = await getAsset(id);
    if (b) assets[id] = await blobToDataURL(b);
  }
  const file: BackupFile = {
    app: 'caleb', kind: 'backup', version: data.version, exportedAt: new Date().toISOString(), data, assets,
  };
  const json = JSON.stringify(file);
  if (opts.passcode) {
    const sealed = await seal(new TextEncoder().encode(json), opts.passcode);
    const wrapped: EncryptedBackupFile = { app: 'caleb', kind: 'encrypted-backup', v: 1, exportedAt: file.exportedAt, ...sealed };
    return new Blob([JSON.stringify(wrapped)], { type: 'application/json' });
  }
  return new Blob([json], { type: 'application/json' });
}

export interface EncryptedBackupFile { app: 'caleb'; kind: 'encrypted-backup'; v: 1; exportedAt: string; salt: string; iv: string; data: string }

/** True if this backup file needs a passcode. */
export function isEncryptedBackup(text: string): boolean {
  return text.length < 2_000_000_000 && /"kind"\s*:\s*"encrypted-backup"/.test(text.slice(0, 200));
}

/** Decrypt an encrypted backup to the plain backup JSON text. */
export async function decryptBackup(text: string, passcode: string): Promise<string> {
  let f: EncryptedBackupFile;
  try { f = JSON.parse(text) as EncryptedBackupFile; } catch { throw new Error('This file is damaged or is not a AACFree backup.'); }
  return new TextDecoder().decode(await unseal(f, passcode));
}

export async function readBackup(text: string): Promise<AppData> {
  let file: Partial<BackupFile>;
  try { file = JSON.parse(text) as Partial<BackupFile>; } catch { throw new Error('This file is damaged or is not a AACFree backup.'); }
  if (!file || typeof file !== 'object' || file.app !== 'caleb' || !Array.isArray(file.data?.profiles) || !file.data.profiles.length) {
    throw new Error('This is not a AACFree backup file.');
  }
  // Validate everything BEFORE writing any assets (throws on a bad or newer file).
  const data = migrate(structuredClone(file.data));
  const assets = file.assets && typeof file.assets === 'object' ? file.assets : {};
  for (const [id, url] of Object.entries(assets)) {
    if (!/^[\w-]{1,80}$/.test(id) || typeof url !== 'string' || !/^data:(image|audio)\/[\w.+-]+;base64,/.test(url)) continue;
    await putAsset(id, await dataURLToBlob(url));
  }
  return data;
}

export function backupFilename(name = 'aacfree') {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'aacfree'}-backup-${stamp}.json`;
}
