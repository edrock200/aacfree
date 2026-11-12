import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { AppData, Profile } from '../types';
import { migrate } from '../store';
import { referencedAssets } from './backup';
import { allAssetIds, getAsset, putAsset } from './db';
import { blobToDataURL, dataURLToBlob } from './util';
import { ITER, KDF, b64, seal, unseal, type Sealed } from './crypto';
import { FILE_STRIP_SETTINGS, canon } from './stamps';

export { mergeData, totalReceived, type MergeSummary, type SyncConflict } from './merge';

/**
 * Device-to-device sync without any server: an encrypted file (AES-256-GCM,
 * key from a passcode via PBKDF2-SHA256) that the family moves however they
 * like (share sheet, email, cloud drive, USB), or one shared file that every
 * device reads, merges and writes automatically (autosync.ts).
 *
 * File format v2:
 *   { app, kind: 'sync', v: 2, createdAt, rev, norm, z, kdf, iter, salt, iv, data }
 * Everything except `data` is the header. It holds nothing private (no
 * profile names) and is authenticated as AES-GCM additional data, so it can't
 * be changed without the passcode. `data` is the deflated, encrypted payload:
 *   { app, kind: 'sync-data', v: 2, data: AppData, devices, assets }
 * v1 files (Caleb 0.4: plaintext profile names, no stored iteration count)
 * can still be read and merged.
 */

export interface DeviceInfo { name: string; t: number }

export interface SyncFileV1 {
  app: 'caleb'; kind: 'sync'; v: 1; createdAt: string;
  profiles: string[]; // names, shown before decrypting
  salt: string; iv: string; data: string;
}

export interface SyncFileV2 extends Sealed {
  app: 'caleb'; kind: 'sync'; v: 2; createdAt: string;
  /** Random id of this write (tells a concurrent writer apart). */
  rev: string;
  /** Passcode normalisation: 1 = upper case, no spaces or dashes. */
  norm: 1;
  /** Payload compression. */
  z: 'deflate';
}

export type SyncFile = SyncFileV1 | SyncFileV2;

export interface OpenedSync {
  data: AppData;
  devices: Record<string, DeviceInfo>;
  /** A Caleb 0.4 file. */
  legacy: boolean;
  rev?: string;
  /** Salt of the file (lets automatic sync reuse its cached key). */
  salt: string;
}

// ---------------------------------------------------------------- passcodes

/** No 0/O, 1/I/L: nothing to mix up when reading it out or copying by hand. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const MIN_PASSCODE = 8;

/** A random passcode like "K7QM-4XTR-9PWD": 12 characters from 31, about 59 bits. */
export function suggestPasscode(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length); // rejection sampling: no bias
  while (out.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < limit && out.length < 12) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return [out.slice(0, 4), out.slice(4, 8), out.slice(8)].map((g) => g.join('')).join('-');
}

/** Case, spaces and dashes don't matter when typing a passcode in. */
export const normalizePasscode = (s: string) => s.normalize('NFKC').toUpperCase().replace(/[\s\-_.·]/g, '');

export type Strength = 'short' | 'weak' | 'ok' | 'strong';

/** A rough strength estimate for a typed passcode (shown as a hint). */
export function passcodeStrength(raw: string): { bits: number; level: Strength } {
  const s = normalizePasscode(raw);
  if (s.length < MIN_PASSCODE) return { bits: 0, level: 'short' };
  let pool = 0;
  if (/[0-9]/.test(s)) pool += 10;
  if (/[A-Z]/.test(s)) pool += 26;
  if (/[^0-9A-Z]/.test(s)) pool += 33;
  const distinct = new Set(s).size;
  // Repeated characters and runs (AAAA, 1234) add little.
  let runs = 0;
  for (let i = 1; i < s.length; i++) if (Math.abs(s.charCodeAt(i) - s.charCodeAt(i - 1)) <= 1) runs++;
  const effective = Math.max(1, Math.min(s.length, distinct * 1.5) - runs * 0.5);
  const bits = Math.round(effective * Math.log2(Math.max(pool, 2)) * (/^[A-Z]+$/.test(s) ? 0.6 : 1));
  return { bits, level: bits >= 50 ? 'strong' : bits >= 35 ? 'ok' : 'weak' };
}

// ---------------------------------------------------------------- reading the header

/** Parse the first JSON object in the text (a provider that doesn't truncate can leave old bytes after it). */
export function parseLeadingJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* try the leading object */ }
  let i = 0;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== '{') throw new Error('bad json');
  let depth = 0;
  let inStr = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (ch === '\\') j++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(text.slice(i, j + 1));
  }
  throw new Error('bad json');
}

export function peekSyncFile(text: string): SyncFile {
  let f: SyncFile;
  try { f = parseLeadingJSON(text) as SyncFile; } catch { throw new Error('This file is damaged or is not a Caleb sync file.'); }
  if (!f || typeof f !== 'object' || f.app !== 'caleb' || f.kind !== 'sync' || typeof f.data !== 'string' || typeof f.salt !== 'string' || typeof f.iv !== 'string') {
    throw new Error('This is not a Caleb sync file.');
  }
  if (f.v !== 1 && f.v !== 2) throw new Error('This file was made by a newer version of Caleb. Please update the app first.');
  return f;
}

/** The authenticated header: every field except the IV and ciphertext, in a fixed order. */
const headerAAD = (f: Omit<SyncFileV2, 'data' | 'iv'> & { data?: string; iv?: string }) => {
  const { data: _d, iv: _iv, ...h } = f;
  void _d; void _iv;
  return strToU8(canon(h));
};

// ---------------------------------------------------------------- writing

async function collectAssets(data: AppData, includeMedia: boolean): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  if (!includeMedia) return assets;
  const refs = referencedAssets(data);
  if (!refs.size) return assets;
  const existing = new Set(await allAssetIds());
  for (const id of refs) {
    if (!existing.has(id)) continue;
    const b = await getAsset(id);
    if (b) assets[id] = await blobToDataURL(b);
  }
  return assets;
}

/** What goes into a sync file: the chosen profiles without device-only settings, plus the library. */
export function syncSubset(data: AppData, profileIds?: string[]): AppData {
  const strip = (p: Profile): Profile => {
    const settings = { ...p.settings } as unknown as Record<string, unknown>;
    for (const k of FILE_STRIP_SETTINGS) delete settings[k];
    return { ...p, settings: settings as unknown as Profile['settings'] };
  };
  const profiles = (profileIds ? data.profiles.filter((p) => profileIds.includes(p.id)) : data.profiles).map(strip);
  // The grown-up lock belongs to this device and never travels in a sync file.
  const { grownUpLock: _lock, ...rest } = data;
  void _lock;
  return { ...rest, profiles, activeProfileId: profiles[0]?.id ?? data.activeProfileId };
}

export interface BuildOptions {
  profileIds?: string[];
  devices?: Record<string, DeviceInfo>;
  /** Reuse this salt (and so a cached key). */
  salt?: string;
  includeMedia?: boolean;
}

/** Make the text of a v2 sync file. */
export async function buildSyncText(data: AppData, passcode: string, opts: BuildOptions = {}): Promise<{ text: string; rev: string }> {
  if (normalizePasscode(passcode).length < MIN_PASSCODE) throw new Error('Use a passcode of at least 8 characters.');
  const subset = syncSubset(data, opts.profileIds);
  if (!subset.profiles.length) throw new Error('Choose at least one profile.');
  const payload = {
    app: 'caleb', kind: 'sync-data', v: 2, data: subset, devices: opts.devices ?? {},
    assets: await collectAssets(subset, opts.includeMedia !== false),
  };
  const plain = deflateSync(strToU8(JSON.stringify(payload)), { level: 6 });
  const rev = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('');
  const salt = opts.salt ?? b64(crypto.getRandomValues(new Uint8Array(16)));
  const header: Omit<SyncFileV2, 'data' | 'iv'> = {
    app: 'caleb', kind: 'sync', v: 2, createdAt: new Date().toISOString(), rev, norm: 1, z: 'deflate', kdf: KDF, iter: ITER, salt,
  };
  const sealed = await seal(plain, normalizePasscode(passcode), { aad: headerAAD(header), salt, iter: ITER });
  const file: SyncFileV2 = { ...header, iv: sealed.iv, data: sealed.data };
  return { text: JSON.stringify(file), rev };
}

/** Manual "Send": a sync file for the chosen profiles. */
export async function createSyncFile(data: AppData, profileIds: string[], passcode: string, devices?: Record<string, DeviceInfo>): Promise<Blob> {
  const { text } = await buildSyncText(data, passcode, { profileIds, devices });
  return new Blob([text], { type: 'application/json' });
}

// ---------------------------------------------------------------- opening

const ASSET_URL = /^data:(image|audio)\/[\w.+-]+;base64,/;

async function storeAssets(assets: unknown) {
  if (!assets || typeof assets !== 'object') return;
  const have = new Set(await allAssetIds());
  for (const [id, url] of Object.entries(assets as Record<string, unknown>)) {
    if (have.has(id) || !/^[\w-]{1,80}$/.test(id) || typeof url !== 'string' || !ASSET_URL.test(url)) continue;
    await putAsset(id, await dataURLToBlob(url));
  }
}

function cleanDevices(raw: unknown): Record<string, DeviceInfo> {
  const out: Record<string, DeviceInfo> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[\w-]{1,40}$/.test(id) || id === '__proto__' || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    if (typeof o.name === 'string' && typeof o.t === 'number' && Number.isFinite(o.t)) out[id] = { name: o.name.slice(0, 40), t: o.t };
  }
  return out;
}

/** Decrypt and validate a sync file. Photos and recordings this device lacks are stored. */
export async function openSyncFile(f: SyncFile, passcode: string): Promise<OpenedSync> {
  if (f.v === 1) {
    const plain = await unseal(f, passcode);
    let backup: { app?: string; data?: AppData; assets?: unknown };
    try { backup = JSON.parse(new TextDecoder().decode(plain)); } catch { throw new Error('This file is damaged or is not a Caleb sync file.'); }
    if (backup?.app !== 'caleb' || !backup.data?.profiles?.length) throw new Error('This is not a Caleb sync file.');
    const data = migrate(structuredClone(backup.data)); // validates (throws on a bad or newer file)
    await storeAssets(backup.assets);
    return { data, devices: {}, legacy: true, salt: f.salt };
  }
  const plain = await unseal(f, normalizePasscode(passcode), { aad: headerAAD(f) });
  let payload: { app?: string; kind?: string; data?: AppData; devices?: unknown; assets?: unknown };
  try { payload = JSON.parse(strFromU8(f.z === 'deflate' ? inflateSync(plain) : plain)); } catch { throw new Error('This file is damaged or is not a Caleb sync file.'); }
  if (payload?.app !== 'caleb' || payload.kind !== 'sync-data' || !payload.data?.profiles?.length) throw new Error('This is not a Caleb sync file.');
  const data = migrate(structuredClone(payload.data));
  await storeAssets(payload.assets);
  return { data, devices: cleanDevices(payload.devices), legacy: false, rev: f.rev, salt: f.salt };
}

/** Combine two device-name lists (newest name wins). */
export function mergeDevices(a: Record<string, DeviceInfo>, b: Record<string, DeviceInfo>): Record<string, DeviceInfo> {
  const m = new Map(Object.entries(a));
  for (const [id, v] of Object.entries(b)) { const cur = m.get(id); if (!cur || v.t > cur.t) m.set(id, v); }
  return Object.fromEntries(m);
}
