import type { AppData, LibraryCategory, Profile } from '../types';
import { createBackup, readBackup } from './backup';

/**
 * Device-to-device sync without any server: an encrypted file (AES-256-GCM,
 * key from a passcode via PBKDF2-SHA256, 250k iterations) that the family moves
 * however they like — share sheet, email, cloud drive, USB. Only someone with
 * the passcode can open it.
 */

import { seal, unseal } from './crypto';

export interface SyncFile {
  app: 'caleb';
  kind: 'sync';
  v: 1;
  createdAt: string;
  profiles: string[]; // names, shown before decrypting
  salt: string;
  iv: string;
  data: string; // base64 ciphertext of a backup file
}

export async function createSyncFile(data: AppData, profileIds: string[], passcode: string): Promise<Blob> {
  if (passcode.length < 6) throw new Error('Use a passcode of at least 6 characters.');
  const subset: AppData = { ...data, profiles: data.profiles.filter((p) => profileIds.includes(p.id)) };
  const backup = await createBackup(subset);
  const sealed = await seal(new Uint8Array(await backup.arrayBuffer()), passcode);
  const file: SyncFile = {
    app: 'caleb', kind: 'sync', v: 1, createdAt: new Date().toISOString(),
    profiles: subset.profiles.map((p) => p.name || 'Unnamed'), ...sealed,
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export function peekSyncFile(text: string): SyncFile {
  let f: SyncFile;
  try { f = JSON.parse(text); } catch { throw new Error('This file is damaged or is not a Caleb sync file.'); }
  if (f?.app !== 'caleb' || f.kind !== 'sync' || !f.data || !f.salt || !f.iv) throw new Error('This is not a Caleb sync file.');
  return f;
}

export async function openSyncFile(f: SyncFile, passcode: string): Promise<AppData> {
  const plain = await unseal(f, passcode);
  return readBackup(new TextDecoder().decode(plain)); // validates + stores photos/recordings
}

export interface MergeSummary { added: string[]; updated: string[]; kept: string[] }

/** Merge synced data into this device: newest version of each profile wins; libraries are combined. */
export function mergeData(local: AppData, incoming: AppData): { data: AppData; summary: MergeSummary } {
  const summary: MergeSummary = { added: [], updated: [], kept: [] };
  const profiles: Profile[] = [...local.profiles];
  for (const p of incoming.profiles) {
    const i = profiles.findIndex((x) => x.id === p.id);
    const name = p.name || 'Unnamed';
    if (i < 0) { profiles.push(p); summary.added.push(name); continue; }
    const a = profiles[i].updatedAt ?? profiles[i].createdAt ?? 0;
    const b = p.updatedAt ?? p.createdAt ?? 0;
    if (b > a) { profiles[i] = p; summary.updated.push(name); } else summary.kept.push(profiles[i].name || 'Unnamed');
  }
  const lib = structuredClone(local.library);
  for (const c of incoming.library?.categories ?? []) {
    const mine = lib.categories.find((x) => x.id === c.id);
    if (!mine) lib.categories.push(c);
    else mergeSymbols(mine, c);
  }
  for (const [k, v] of Object.entries(incoming.library?.additions ?? {})) {
    const have = new Set((lib.additions[k] ?? []).map((s) => s.id));
    lib.additions[k] = [...(lib.additions[k] ?? []), ...v.filter((s) => !have.has(s.id))];
  }
  return { data: { ...local, profiles, library: lib }, summary };
}

function mergeSymbols(mine: LibraryCategory, theirs: LibraryCategory) {
  const have = new Set(mine.symbols.map((s) => s.id));
  mine.symbols.push(...theirs.symbols.filter((s) => !have.has(s.id)));
}

/** A memorable random passcode, e.g. "tiger-cloud-41". */
export function suggestPasscode(): string {
  const words = ['apple', 'tiger', 'cloud', 'river', 'rocket', 'maple', 'ocean', 'pepper', 'comet', 'garden', 'piano', 'lemon', 'panda', 'stone', 'violet', 'island'];
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${words[r[0] % words.length]}-${words[r[1] % words.length]}-${10 + (r[2] % 90)}`;
}
