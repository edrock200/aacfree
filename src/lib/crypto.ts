/**
 * Passcode encryption shared by sync files and encrypted backups:
 * AES-256-GCM with a key derived by PBKDF2-SHA256.
 *
 * Every sealed object records its key derivation (`kdf`, `iter`, `salt`), so
 * the iteration count can be raised later without breaking old files. Files
 * written before that (Caleb 0.4) have no `iter` and used 250,000 iterations.
 * Callers can pass additional authenticated data (`aad`): plaintext header
 * fields that are not secret but must not be changed by anyone without the
 * passcode.
 */
export const KDF = 'PBKDF2-SHA256';
/** Iterations used for new files. */
export const ITER = 250_000;
/** What files without an `iter` field used. */
const LEGACY_ITER = 250_000;
/** Refuse absurd counts from a crafted file (would freeze the app). */
const MIN_ITER = 100_000;
const MAX_ITER = 5_000_000;
const enc = new TextEncoder();

/** Chunked base64 (large files, works in Node tests too). */
export const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Derived keys are cached for the session, so automatic sync doesn't pay the slow derivation every few minutes. */
const keyCache = new Map<string, Promise<CryptoKey>>();

async function derive(passcode: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function keyFrom(passcode: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const id = `${iterations}|${saltB64}|${passcode}`;
  let k = keyCache.get(id);
  if (!k) {
    k = derive(passcode, unb64(saltB64), iterations);
    k.catch(() => keyCache.delete(id));
    if (keyCache.size >= 6) keyCache.delete(keyCache.keys().next().value!);
    keyCache.set(id, k);
  }
  return k;
}

/** Forget cached keys (e.g. when sync is turned off). */
export const forgetKeys = () => keyCache.clear();

export interface Sealed {
  salt: string;
  iv: string;
  data: string;
  /** Key derivation; missing in Caleb 0.4 files (PBKDF2-SHA256, 250k). */
  kdf?: string;
  iter?: number;
}

export interface SealOptions {
  /** Additional authenticated data (not encrypted, but tamper-proof). */
  aad?: Uint8Array;
  /** Reuse a salt (base64) so a cached key can be reused; a fresh IV is always used. */
  salt?: string;
  iter?: number;
}

export async function seal(plain: Uint8Array, passcode: string, opts: SealOptions = {}): Promise<Sealed> {
  const salt = opts.salt ?? b64(crypto.getRandomValues(new Uint8Array(16)));
  const iter = opts.iter ?? ITER;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passcode, salt, iter);
  const params: AesGcmParams = { name: 'AES-GCM', iv: iv as BufferSource };
  if (opts.aad) params.additionalData = opts.aad as BufferSource;
  const cipher = new Uint8Array(await crypto.subtle.encrypt(params, key, plain as BufferSource));
  return { kdf: KDF, iter, salt, iv: b64(iv), data: b64(cipher) };
}

export async function unseal(s: Sealed, passcode: string, opts: { aad?: Uint8Array } = {}): Promise<Uint8Array> {
  if (s.kdf !== undefined && s.kdf !== KDF) throw new Error('This file was made by a newer version of Caleb. Please update the app first.');
  const iter = s.iter ?? LEGACY_ITER;
  if (!Number.isInteger(iter) || iter < MIN_ITER || iter > MAX_ITER) throw new Error('This file is damaged or is not a Caleb sync file.');
  if (typeof s.salt !== 'string' || typeof s.iv !== 'string' || typeof s.data !== 'string') throw new Error('This file is damaged or is not a Caleb sync file.');
  let key: CryptoKey;
  try { key = await keyFrom(passcode, s.salt, iter); } catch { throw new Error('This file is damaged or is not a Caleb sync file.'); }
  try {
    const params: AesGcmParams = { name: 'AES-GCM', iv: unb64(s.iv) as BufferSource };
    if (opts.aad) params.additionalData = opts.aad as BufferSource;
    return new Uint8Array(await crypto.subtle.decrypt(params, key, unb64(s.data) as BufferSource));
  } catch {
    throw new Error('Wrong passcode (or the file was changed).');
  }
}
