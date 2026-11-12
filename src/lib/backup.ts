import type { AppData } from '../types';
import { migrate } from '../store';
import { allAssetIds, getAsset, putAsset } from './db';
import { blobToDataURL, dataURLToBlob } from './util';

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

export async function createBackup(data: AppData): Promise<Blob> {
  const refs = referencedAssets(data);
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
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function readBackup(text: string): Promise<AppData> {
  let file: Partial<BackupFile>;
  try { file = JSON.parse(text) as Partial<BackupFile>; } catch { throw new Error('This file is damaged or is not a Caleb backup.'); }
  if (file.app !== 'caleb' || !file.data?.profiles?.length) throw new Error('This is not a Caleb backup file.');
  // Validate everything BEFORE writing any assets (throws on a bad or newer file).
  const data = migrate(structuredClone(file.data));
  for (const [id, url] of Object.entries(file.assets ?? {})) {
    if (!/^[\w-]{1,80}$/.test(id) || typeof url !== 'string' || !/^data:(image|audio)\/[\w.+-]+;base64,/.test(url)) continue;
    await putAsset(id, await dataURLToBlob(url));
  }
  return data;
}

export function backupFilename(name = 'caleb') {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'caleb'}-backup-${stamp}.caleb.json`;
}
