import type { AppData, GrownUpLock, LockMethod } from '../types';

/**
 * The grown-up lock is app-wide (AppData.grownUpLock). Before v0.5 each profile
 * had its own `settings.lock` and `settings.pin`, so adding, importing or
 * switching to an unlocked profile got round a PIN. This module moves old data
 * over and keeps the lock out of anything that crosses devices.
 */

export const DEFAULT_LOCK: GrownUpLock = { lock: 'hold' };

/** Weakest → strongest. */
const STRENGTH: LockMethod[] = ['none', 'hold', 'math', 'pin'];

export const validPin = (x: unknown): x is string => typeof x === 'string' && /^\d{4,6}$/.test(x);

const isMethod = (x: unknown): x is LockMethod => STRENGTH.includes(x as LockMethod);

/** Validates a stored lock. Returns undefined when there is nothing usable. */
export function cleanLock(raw: unknown): GrownUpLock | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!isMethod(o.lock)) return undefined;
  const out: GrownUpLock = { lock: o.lock };
  if (validPin(o.pin)) out.pin = o.pin;
  // A PIN lock without a PIN would lock grown-ups out for good.
  if (out.lock === 'pin' && !out.pin) out.lock = 'hold';
  if (typeof o.pinNotice === 'string') out.pinNotice = o.pinNotice.slice(0, 100);
  return out;
}

interface Legacy { id: unknown; name: string; updatedAt: number; method: LockMethod; pin?: string }

/** Reads (and removes) the per-profile lock fields older versions stored in settings. */
function takeLegacy(data: AppData): Legacy[] {
  const out: Legacy[] = [];
  for (const p of data.profiles as unknown[]) {
    if (!p || typeof p !== 'object') continue;
    const prof = p as Record<string, unknown>;
    const s = prof.settings;
    if (!s || typeof s !== 'object') continue;
    const set = s as Record<string, unknown>;
    if (!('lock' in set) && !('pin' in set)) continue;
    const pin = validPin(set.pin) ? set.pin : undefined;
    let method: LockMethod = isMethod(set.lock) ? set.lock : 'hold';
    if (method === 'pin' && !pin) method = 'hold';
    out.push({
      id: prof.id,
      name: typeof prof.name === 'string' ? prof.name : '',
      updatedAt: Number(prof.updatedAt ?? prof.createdAt) || 0,
      method,
      pin,
    });
    delete set.lock;
    delete set.pin;
  }
  return out;
}

/**
 * Moves the lock to app level. If the data already has a valid app-wide lock it
 * wins, and any per-profile leftovers (e.g. from an older device) are dropped.
 * Otherwise the strictest per-profile lock is kept: a PIN if any profile had
 * one. When profiles had different PINs, the active profile's PIN is kept (or
 * the most recently changed profile's) and `pinNotice` is set so the grown-up
 * is told once.
 */
export function migrateLock(data: AppData): AppData {
  const legacy = Array.isArray(data.profiles) ? takeLegacy(data) : [];
  const existing = cleanLock(data.grownUpLock);
  if (existing) {
    data.grownUpLock = existing;
    return data;
  }
  if (!legacy.length) {
    data.grownUpLock = { ...DEFAULT_LOCK };
    return data;
  }
  const strongest = legacy.reduce<LockMethod>((m, l) => (STRENGTH.indexOf(l.method) > STRENGTH.indexOf(m) ? l.method : m), 'none');
  const active = legacy.find((l) => l.id === data.activeProfileId);
  if (strongest !== 'pin') {
    data.grownUpLock = { lock: strongest };
    // Keep a PIN the active profile had saved, so choosing "PIN" later still works.
    if (active?.pin) data.grownUpLock.pin = active.pin;
    return data;
  }
  const withPin = legacy.filter((l) => l.method === 'pin');
  const keep = active?.method === 'pin' ? active : [...withPin].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  data.grownUpLock = { lock: 'pin', pin: keep.pin };
  if (new Set(withPin.map((l) => l.pin)).size > 1) data.grownUpLock.pinNotice = keep.name || 'Unnamed';
  return data;
}

/**
 * The lock belongs to this device. Restoring a backup or snapshot, or syncing,
 * keeps the device's current lock instead of taking the file's.
 */
export function keepDeviceLock(next: AppData, current: AppData | undefined): AppData {
  const mine = cleanLock(current?.grownUpLock);
  if (mine) next.grownUpLock = mine;
  return next;
}

/** A copy without the PIN (for files that leave the device unencrypted). */
export function withoutPin(data: AppData): AppData {
  if (!data.grownUpLock?.pin) return data;
  const { pin: _pin, ...rest } = data.grownUpLock;
  void _pin;
  return { ...data, grownUpLock: { ...rest, lock: rest.lock === 'pin' ? 'hold' : rest.lock } };
}
