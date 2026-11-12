/**
 * Passcode encryption shared by sync files and encrypted backups:
 * AES-256-GCM with a key derived by PBKDF2-SHA256 (250k iterations).
 */
const ITER = 250_000;
const enc = new TextEncoder();

/** Chunked base64 (large files, works in Node tests too). */
export const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(passcode: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export interface Sealed { salt: string; iv: string; data: string }

export async function seal(plain: Uint8Array, passcode: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passcode, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource));
  return { salt: b64(salt), iv: b64(iv), data: b64(cipher) };
}

export async function unseal(s: Sealed, passcode: string): Promise<Uint8Array> {
  const key = await keyFrom(passcode, unb64(s.salt));
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) as BufferSource }, key, unb64(s.data) as BufferSource));
  } catch {
    throw new Error('Wrong passcode (or the file was changed).');
  }
}
