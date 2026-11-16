import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AACButton, AppData, Profile, SymbolLibrary } from '../../types';
import { buildProfile } from '../../data/defaults';
import { migrate } from '../../store';
import { resizeBoard } from '../boards';
import { mergeData, totalReceived } from '../merge';
import { LOCAL_SETTINGS, canon, getClock, observeData, profileItems, setDevice, stampData } from '../stamps';
import {
  buildSyncText, createSyncFile, normalizePasscode, openSyncFile, parseLeadingJSON, passcodeStrength, peekSyncFile, suggestPasscode,
  type SyncFileV1,
} from '../sync';
import { b64, seal, unseal } from '../crypto';
import { createBackup, decryptBackup } from '../backup';

// ---------------------------------------------------------------- a small multi-device simulator

let now = 1_750_000_000_000;
let skew = 0;
const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now + skew);
afterAll(() => nowSpy.mockRestore());

interface Device { id: string; data: AppData; clock: number; skew: number }

const emptyLib = (): SymbolLibrary => ({ categories: [], additions: {} });

function newData(name = 'Sam'): AppData {
  const p = buildProfile(name, 'medium');
  p.createdAt = now;
  return migrate({ version: 1, profiles: [p], activeProfileId: p.id, onboarded: true, library: emptyLib() });
}

function on<T>(dev: Device, fn: () => T): T {
  setDevice(dev.id, dev.clock);
  skew = dev.skew;
  try { return fn(); } finally { dev.clock = getClock(); skew = 0; }
}

/** A local edit, the way the store does it: clone the active profile, change it, stamp. */
function edit(dev: Device, fn: (p: Profile) => void, profileIndex = 0) {
  on(dev, () => {
    const cur = dev.data.profiles[profileIndex];
    const next = structuredClone(cur);
    fn(next);
    next.updatedAt = Date.now();
    dev.data = stampData(dev.data, { ...dev.data, profiles: dev.data.profiles.map((p, i) => (i === profileIndex ? next : p)) });
  });
  now += 1000;
}

function editLib(dev: Device, fn: (l: SymbolLibrary) => void) {
  on(dev, () => {
    const lib = structuredClone(dev.data.library);
    fn(lib);
    dev.data = stampData(dev.data, { ...dev.data, library: lib });
  });
  now += 1000;
}

/** Speaking: a shallow update of history + learned words (activity). */
function speak(dev: Device, text: string) {
  on(dev, () => {
    const cur = dev.data.profiles[0];
    const lexicon = { ...cur.lexicon };
    for (const w of text.toLowerCase().split(' ')) lexicon[w] = (lexicon[w] ?? 0) + 1;
    const next = { ...cur, history: [{ text, t: Date.now() }, ...cur.history].slice(0, 100), lexicon, updatedAt: Date.now() };
    dev.data = stampData(dev.data, { ...dev.data, profiles: [next, ...dev.data.profiles.slice(1)] });
  });
  now += 1000;
}

/** Device `dev` merges `other` in (like Receive, or reading the shared file). */
function pull(dev: Device, other: AppData) {
  const r = on(dev, () => {
    const res = mergeData(dev.data, other);
    observeData(res.data);
    return res;
  });
  dev.data = r.data;
  now += 1000;
  return r.summary;
}

const mk = (id: string, data: AppData, devSkew = 0): Device => ({ id, data: structuredClone(data), clock: 0, skew: devSkew });

/** Everything that must be identical whichever device merges (device-only settings excluded). */
function content(d: AppData): string {
  const profiles = [...d.profiles].sort((a, b) => (a.id < b.id ? -1 : 1)).map((p) => {
    const settings = { ...p.settings } as unknown as Record<string, unknown>;
    for (const k of LOCAL_SETTINGS) delete settings[k];
    return { ...p, settings };
  });
  return canon({ profiles, library: d.library, removed: d.sync?.removed ?? {} });
}

const cellAt = (p: Profile, board: string, r: number, c: number) => p.boards[board].cells[r * p.boards[board].cols + c];
const btn = (label: string): AACButton => ({ id: 'b' + label, label, type: 'noun' });

let base: AppData;
beforeEach(() => {
  now += 3600_000;
  base = newData();
});

// ---------------------------------------------------------------- stamping

describe('change stamps', () => {
  it('stamps only the items that changed, keyed by board row/column', () => {
    const a = mk('devA', base);
    edit(a, (p) => { p.boards.home.cells[5] = btn('pizza'); });
    const p = a.data.profiles[0];
    const cols = p.boards.home.cols;
    const key = `c:home:${Math.floor(5 / cols)}:${5 % cols}`;
    expect(p.sync!.stamps[key].d).toBe('devA');
    const fresh = Object.entries(p.sync!.stamps).filter(([, s]) => s.d === 'devA').map(([k]) => k);
    expect(fresh).toEqual([key]);
  });

  it('keeps keys stable when a board is resized (buttons never move)', () => {
    const a = mk('devA', base);
    const before = a.data.profiles[0].sync!.stamps;
    edit(a, (p) => { p.boards.home = resizeBoard(p.boards.home, p.boards.home.cols + 1, p.boards.home.rows).board; });
    const after = a.data.profiles[0].sync!.stamps;
    // Only the board details changed; every button keeps its key and stamp.
    const changed = Object.keys(after).filter((k) => after[k] !== before[k] && canon(after[k]) !== canon(before[k]));
    expect(changed).toEqual(['b:home']);
  });

  it('speaking, history and learned words are not content changes', () => {
    const a = mk('devA', base);
    const before = a.data.profiles[0].sync!.stamps;
    speak(a, 'I want juice');
    expect(a.data.profiles[0].sync!.stamps).toBe(before);
    expect(a.data.profiles[0].sync!.lexT).toBeGreaterThan(0);
  });

  it('device-only settings (voice, calibration) are never stamped', () => {
    const a = mk('devA', base);
    const before = a.data.profiles[0].sync!.stamps;
    edit(a, (p) => { p.settings.voiceURI = 'x'; p.settings.volume = 0.3; p.settings.gazeCalibration = [[1, 2]]; });
    expect(a.data.profiles[0].sync!.stamps).toEqual(before);
    edit(a, (p) => { p.settings.rate = 1.3; });
    expect(a.data.profiles[0].sync!.stamps['set:rate'].d).toBe('devA');
  });

  it('seeds old data (no stamps) from updatedAt so first syncs act like the old merge', () => {
    const p = buildProfile('Old', 'medium');
    p.updatedAt = 12345;
    const d = migrate({ version: 1, profiles: [p], activeProfileId: p.id, onboarded: true, library: emptyLib() });
    const s = d.profiles[0].sync!;
    expect(Object.keys(s.stamps).length).toBe(profileItems(d.profiles[0]).size);
    expect(Object.values(s.stamps).every((x) => x.t === 12345 && x.d === 'legacy')).toBe(true);
  });

  it('migrate keeps valid stamps and drops hostile ones', () => {
    const d = structuredClone(base) as unknown as Record<string, unknown> & AppData;
    const p = d.profiles[0] as Profile & { sync: Record<string, unknown> };
    (p.sync.stamps as Record<string, unknown>)['__proto__'] = { t: 1, d: 'x' };
    (p.sync.stamps as Record<string, unknown>)['c:home:0:0'] = { t: 'soon', d: 'x' };
    p.sync.seen = { constructor: 5, devA: 7 } as never;
    const m = migrate(d);
    expect(Object.getPrototypeOf(m.profiles[0].sync!.stamps)).toBe(Object.prototype);
    expect(m.profiles[0].sync!.stamps['c:home:0:0'].d).toBe('legacy'); // reseeded
    expect(m.profiles[0].sync!.seen.devA).toBe(7);
  });

  it('is fast enough for 50 boards of 48 buttons', () => {
    const p = buildProfile('Big', 'full');
    for (let i = 0; i < 50; i++) {
      p.boards[`x${i}`] = { id: `x${i}`, name: `Board ${i}`, cols: 8, rows: 6, cells: Array.from({ length: 48 }, (_, j) => btn(`w${i}_${j}`)) };
    }
    const d = migrate({ version: 1, profiles: [p], activeProfileId: p.id, onboarded: true, library: emptyLib() });
    const a = mk('devA', d);
    nowSpy.mockRestore();
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) edit(a, (pp) => { pp.boards.x3.cells[i] = btn(`new${i}`); });
    const per = (performance.now() - t0) / 10;
    const t1 = performance.now();
    const b = mk('devB', a.data);
    edit(b, (pp) => { pp.boards.x7.cells[1] = btn('other'); });
    mergeData(a.data, b.data);
    const mergeMs = performance.now() - t1;
    vi.spyOn(Date, 'now').mockImplementation(() => now + skew);
    expect(per).toBeLessThan(150); // includes a full structuredClone, like the store
    expect(mergeMs).toBeLessThan(1500);
  });
});

// ---------------------------------------------------------------- merging

describe('change-by-change merge', () => {
  it('defect 1: a parent edits on the phone while the child talks on the tablet — both survive', () => {
    const phone = mk('phone', base);
    const tablet = mk('tablet', base);
    edit(phone, (p) => { p.boards.home.cells[0] = btn('grandma'); });
    edit(tablet, (p) => { p.settings.voiceURI = 'tablet-voice'; });
    tablet.data = { ...tablet.data, grownUpLock: { lock: 'pin', pin: '1234' } };
    speak(tablet, 'I want juice');
    speak(tablet, 'more please');
    const s = pull(tablet, phone.data);
    const tp = tablet.data.profiles[0];
    expect(tp.boards.home.cells[0]!.label).toBe('grandma');
    expect(tp.history.map((h) => h.text)).toEqual(['more please', 'I want juice']);
    expect(tp.lexicon.juice).toBe(1);
    expect(tp.settings.voiceURI).toBe('tablet-voice');
    expect(tablet.data.grownUpLock).toEqual({ lock: 'pin', pin: '1234' });
    expect(s.received.phone).toBe(1);
    expect(s.conflicts).toEqual([]);
    // And the other way round: the phone gets the tablet's history but keeps its own voice.
    pull(phone, tablet.data);
    expect(phone.data.profiles[0].history.length).toBe(2);
    expect(phone.data.profiles[0].settings.voiceURI).toBeUndefined();
    expect(content(phone.data)).toBe(content(tablet.data));
  });

  it('different items changed on two devices are both kept, with no conflict', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    edit(a, (p) => { p.boards.home.cells[1] = btn('cat'); p.settings.rate = 1.2; });
    edit(b, (p) => { p.boards.home.cells[2] = btn('dog'); p.phrases.push({ id: 'ph1', text: 'Hello there', category: p.phraseCategories[0] }); });
    const s = pull(a, b.data);
    const p = a.data.profiles[0];
    expect([p.boards.home.cells[1]!.label, p.boards.home.cells[2]!.label]).toEqual(['cat', 'dog']);
    expect(p.phrases.some((x) => x.id === 'ph1')).toBe(true);
    expect(p.settings.rate).toBe(1.2);
    expect(s.conflicts).toEqual([]);
    expect(s.sent).toBe(2);
  });

  it('the same item changed on both: the newer wins and a conflict is reported', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    edit(a, (p) => { p.boards.home.cells[3] = btn('older'); });
    edit(b, (p) => { p.boards.home.cells[3] = btn('newer'); });
    const s = pull(a, b.data);
    expect(a.data.profiles[0].boards.home.cells[3]!.label).toBe('newer');
    expect(s.conflicts.length).toBe(1);
    expect(s.conflicts[0]).toMatchObject({ kind: 'button', what: 'older', where: 'Home' });
    expect(s.conflicts[0].kept.d).toBe('devB');
    // Once synced, a later edit on top is not a conflict.
    pull(b, a.data);
    edit(b, (p) => { p.boards.home.cells[3] = btn('again'); });
    expect(pull(a, b.data).conflicts).toEqual([]);
    expect(a.data.profiles[0].boards.home.cells[3]!.label).toBe('again');
  });

  it('a device whose clock is behind still wins with an edit made after it synced', () => {
    const a = mk('devA', base, 0);
    const slow = mk('slow', base, -3 * 3600_000); // three hours behind
    edit(a, (p) => { p.boards.home.cells[4] = btn('from A'); });
    pull(slow, a.data);
    edit(slow, (p) => { p.boards.home.cells[4] = btn('from slow, later'); });
    pull(a, slow.data);
    expect(a.data.profiles[0].boards.home.cells[4]!.label).toBe('from slow, later');
  });

  it('a deletion wins over an older edit, and an edit after the deletion brings it back', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    edit(b, (p) => { p.boards.home.cells[6] = btn('edited first'); });
    edit(a, (p) => { p.boards.home.cells[6] = null; });
    pull(b, a.data);
    expect(b.data.profiles[0].boards.home.cells[6]).toBeNull();
    edit(b, (p) => { p.boards.home.cells[6] = btn('back again'); });
    pull(a, b.data);
    expect(a.data.profiles[0].boards.home.cells[6]!.label).toBe('back again');
  });

  it('a folder deleted on one device while a word in it was edited on another comes back whole, with its folder button', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    const folder = Object.values(base.profiles[0].boards).find((x) => x.id !== 'home' && x.cells.filter(Boolean).length > 5)!;
    const linkIdx = base.profiles[0].boards.home.cells.findIndex((c) => c?.link === folder.id);
    expect(linkIdx).toBeGreaterThanOrEqual(0);
    edit(a, (p) => {
      delete p.boards[folder.id];
      for (const bb of Object.values(p.boards)) bb.cells = bb.cells.map((c) => (c?.link === folder.id ? null : c));
    });
    edit(b, (p) => { p.boards[folder.id].cells[0] = btn('new word'); });
    const ab = mergeData(a.data, b.data).data;
    const ba = mergeData(b.data, a.data).data;
    expect(content(ab)).toBe(content(ba));
    const got = ab.profiles[0].boards[folder.id];
    expect(got).toBeTruthy();
    expect(got.cells[0]!.label).toBe('new word');
    expect(got.cells.filter(Boolean).length).toBe(folder.cells.filter(Boolean).length);
    expect(ab.profiles[0].boards.home.cells[linkIdx]?.link).toBe(folder.id);
    // ...but a deletion after the edit sticks.
    const b2 = mk('devB', ab);
    edit(b2, (p) => { delete p.boards[folder.id]; for (const bb of Object.values(p.boards)) bb.cells = bb.cells.map((c) => (c?.link === folder.id ? null : c)); });
    expect(mergeData(ab, b2.data).data.profiles[0].boards[folder.id]).toBeUndefined();
  });

  it('a board shrunk on one device does not swallow a button added later outside the new size', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    const h = base.profiles[0].boards.home;
    edit(a, (p) => { p.boards.home = resizeBoard(p.boards.home, h.cols - 1, h.rows).board; });
    edit(b, (p) => { p.boards.home.cells[h.cols - 1] = btn('edge'); });
    const m = mergeData(a.data, b.data).data;
    expect(content(m)).toBe(content(mergeData(b.data, a.data).data));
    expect(cellAt(m.profiles[0], 'home', 0, h.cols - 1)!.label).toBe('edge');
  });

  it('history: union without duplicates, minus rows a grown-up removed; "forget learned words" sticks', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    speak(a, 'one two');
    pull(b, a.data);
    speak(b, 'three');
    speak(a, 'four');
    edit(a, (p) => { p.history = p.history.filter((x) => x.text !== 'one two'); });
    pull(a, b.data);
    expect(a.data.profiles[0].history.map((x) => x.text)).toEqual(['four', 'three']);
    edit(a, (p) => { p.lexicon = {}; });
    pull(b, a.data);
    expect(b.data.profiles[0].lexicon).toEqual({});
    speak(b, 'five');
    pull(a, b.data);
    expect(Object.keys(a.data.profiles[0].lexicon)).toEqual(['five']);
  });

  it('undo right after "clear recent" keeps the sentences on every device', () => {
    const a = mk('devA', base);
    speak(a, 'hello there');
    speak(a, 'all done');
    const b = mk('devB', a.data);
    const kept = a.data.profiles[0].history;
    edit(a, (p) => { p.history = []; });
    edit(a, (p) => { p.history = kept; }); // Undo
    pull(b, a.data);
    expect(b.data.profiles[0].history.map((h) => h.text)).toEqual(['all done', 'hello there']);
    edit(a, (p) => { p.history = []; }); // cleared for real this time
    pull(b, a.data);
    expect(b.data.profiles[0].history).toEqual([]);
  });

  it('profile deletion propagates, but a manual file holding only some profiles deletes nothing', () => {
    const a = mk('devA', base);
    on(a, () => { const p2 = buildProfile('Ava', 'big'); a.data = stampData(a.data, { ...a.data, profiles: [...a.data.profiles, p2] }); });
    const b = mk('devB', a.data);
    const partial = { ...a.data, profiles: [a.data.profiles[0]] };
    expect(mergeData(b.data, partial).data.profiles.length).toBe(2);
    on(a, () => { a.data = stampData(a.data, { ...a.data, profiles: [a.data.profiles[0]] }); });
    const s = pull(b, a.data);
    expect(b.data.profiles.map((p) => p.name)).toEqual(['Sam']);
    expect(s.removed).toEqual(['Ava']);
  });

  it('library: additions from both devices combine; a deleted category stays deleted', () => {
    const a = mk('devA', base);
    const b = mk('devB', base);
    editLib(a, (l) => { l.categories.push({ id: 'c1', name: 'Soccer', symbols: [{ id: 's1', label: 'goal', symbol: 'e:🥅' }] }); });
    editLib(b, (l) => { l.categories.push({ id: 'c2', name: 'Zoo', symbols: [] }); l.additions.food = [{ id: 's9', label: 'taco', symbol: 'e:🌮' }]; });
    pull(a, b.data);
    pull(b, a.data);
    expect(a.data.library.categories.map((c) => c.name).sort()).toEqual(['Soccer', 'Zoo']);
    expect(content(a.data)).toBe(content(b.data));
    editLib(a, (l) => { l.categories = l.categories.filter((c) => c.id !== 'c2'); });
    pull(b, a.data);
    expect(b.data.library.categories.map((c) => c.name)).toEqual(['Soccer']);
    expect(b.data.library.additions.food[0].label).toBe('taco');
  });

  it('reads and merges an old v0.4 file (no stamps, newest updatedAt wins)', async () => {
    const tablet = structuredClone(base.profiles[0]);
    delete tablet.sync;
    tablet.updatedAt = now + 10_000;
    tablet.boards.home.cells[0] = btn('from 0.4');
    const oldData = { version: 1, profiles: [tablet], activeProfileId: tablet.id, onboarded: true, library: emptyLib() };
    const backup = await createBackup(oldData as AppData);
    const sealed = await seal(new Uint8Array(await backup.arrayBuffer()), 'tiger-cloud-41');
    const v1: SyncFileV1 = { app: 'caleb', kind: 'sync', v: 1, createdAt: new Date().toISOString(), profiles: ['Sam'], salt: sealed.salt, iv: sealed.iv, data: sealed.data };
    const opened = await openSyncFile(peekSyncFile(JSON.stringify(v1)), 'tiger-cloud-41');
    expect(opened.legacy).toBe(true);
    const a = mk('devA', base);
    pull(a, opened.data);
    expect(a.data.profiles[0].boards.home.cells[0]!.label).toBe('from 0.4');
  }, 30000);
});

// ---------------------------------------------------------------- property tests

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

function randomOp(dev: Device, r: () => number, n: number) {
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const p = dev.data.profiles[0];
  const ids = Object.keys(p.boards);
  const op = Math.floor(r() * 16);
  switch (op) {
    case 0: case 1: case 2: return edit(dev, (pp) => { const b = pp.boards[pick(ids)]; b.cells[Math.floor(r() * b.cells.length)] = btn(`w${n}${dev.id}`); });
    case 3: return edit(dev, (pp) => { const b = pp.boards[pick(ids)]; b.cells[Math.floor(r() * b.cells.length)] = null; });
    case 4: return edit(dev, (pp) => {
      const id = pick(ids);
      const b = pp.boards[id];
      pp.boards[id] = resizeBoard(b, Math.max(2, Math.min(9, b.cols + (r() < 0.5 ? -1 : 1))), Math.max(2, Math.min(8, b.rows + (r() < 0.5 ? -1 : 1)))).board;
    });
    case 5: {
      const victims = ids.filter((id) => id !== p.rootId);
      if (!victims.length) return;
      const id = pick(victims);
      return edit(dev, (pp) => { delete pp.boards[id]; for (const b of Object.values(pp.boards)) b.cells = b.cells.map((c) => (c?.link === id ? null : c)); });
    }
    case 6: return edit(dev, (pp) => {
      const id = `nb${n}${dev.id}`;
      pp.boards[id] = { id, name: `New ${n}`, cols: 3, rows: 2, cells: [btn('a'), btn('b'), null, null, null, null] };
      const home = pp.boards[pp.rootId];
      home.cells[Math.floor(r() * home.cells.length)] = { id: 'f' + id, label: 'Folder', type: 'folder', link: id };
    });
    case 7: return edit(dev, (pp) => { pp.settings.rate = Math.round(r() * 20) / 10; pp.settings.volume = r(); });
    case 8: return edit(dev, (pp) => { pp.phrases.push({ id: `ph${n}${dev.id}`, text: `phrase ${n}`, category: pp.phraseCategories[0] }); });
    case 9: return edit(dev, (pp) => { if (pp.phrases.length) pp.phrases.splice(Math.floor(r() * pp.phrases.length), 1); });
    case 10: return speak(dev, `said ${n} by ${dev.id}`);
    case 11: return editLib(dev, (l) => { l.categories.push({ id: `c${n}${dev.id}`, name: `Cat ${n}`, symbols: [{ id: `s${n}`, label: 'x', symbol: 'e:⭐' }] }); });
    case 12: return editLib(dev, (l) => {
      if (!l.categories.length) return;
      if (r() < 0.5) l.categories.splice(Math.floor(r() * l.categories.length), 1);
      else pick(l.categories).symbols.push({ id: `s${n}${dev.id}`, label: `y${n}`, symbol: 'e:🍎' });
    });
    case 13: return edit(dev, (pp) => { pp.aboutMe = { ...pp.aboutMe, text: `About ${n} ${dev.id}` }; });
    case 14: return on(dev, () => {
      // Add a second profile, or delete it again.
      if (dev.data.profiles.length > 1 && r() < 0.6) dev.data = stampData(dev.data, { ...dev.data, profiles: dev.data.profiles.slice(0, 1) });
      else dev.data = stampData(dev.data, { ...dev.data, profiles: [...dev.data.profiles, { ...buildProfile(`P${n}`, 'big'), id: `p${n}${dev.id}` }] });
      now += 1000;
    });
    case 15: return edit(dev, (pp) => { pp.quickBar = r() < 0.5 ? pp.quickBar.slice(1) : [...pp.quickBar, btn(`q${n}${dev.id}`)]; });
  }
}

function checkValid(d: AppData) {
  for (const p of d.profiles) {
    for (const b of Object.values(p.boards)) expect(b.cells.length).toBe(b.cols * b.rows);
    expect(p.boards[p.rootId]).toBeTruthy();
  }
  expect(() => migrate(structuredClone(d))).not.toThrow();
}

describe('merge properties (random edits on three devices)', () => {
  // SYNC_SEEDS=200 npx vitest run sync-v05 runs a longer soak.
  const extra = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SYNC_SEEDS ?? 0);
  const seeds = extra ? Array.from({ length: extra }, (_, i) => 1000 + i) : [1, 7, 42, 99, 1234, 2025];
  for (const seed of seeds) {
    it(`commutative, idempotent and convergent (seed ${seed})`, () => {
      const r = rng(seed);
      const devs = [mk('aa', base, 0), mk('bb', base, 5000), mk('cc', base, -7000)];
      let file: AppData = structuredClone(base);
      let n = 0;
      for (let round = 0; round < 6; round++) {
        for (const d of devs) {
          const k = 1 + Math.floor(r() * 5);
          for (let i = 0; i < k; i++) randomOp(d, r, n++);
        }
        // Pairwise properties on the current (diverged) states.
        for (const [x, y] of [[0, 1], [1, 2], [0, 2]]) {
          const xy = mergeData(devs[x].data, devs[y].data);
          const yx = mergeData(devs[y].data, devs[x].data);
          expect(content(xy.data)).toBe(content(yx.data));
          expect(xy.summary.conflicts.length).toBe(yx.summary.conflicts.length);
          const again = mergeData(xy.data, devs[y].data);
          expect(content(again.data)).toBe(content(xy.data));
          expect(again.summary.localChanged).toBe(false);
          const self = mergeData(xy.data, xy.data);
          expect(content(self.data)).toBe(content(xy.data));
          expect(self.summary.localChanged || self.summary.remoteChanged).toBe(false);
          checkValid(xy.data);
        }
        // Some devices sync through the shared file this round.
        for (const d of devs) {
          if (r() < 0.6) { pull(d, file); file = structuredClone(d.data); }
        }
      }
      // Everyone syncs twice: all copies converge.
      for (let k = 0; k < 2; k++) for (const d of devs) { pull(d, file); file = structuredClone(d.data); }
      for (const d of devs) expect(content(d.data)).toBe(content(file));
      // Merging the file again changes nothing.
      const s = mergeData(devs[0].data, file).summary;
      expect(s.localChanged).toBe(false);
      expect(totalReceived(s)).toBe(0);
    });
  }

  it('an edit nobody else touched always survives a full round of syncs', () => {
    const r = rng(5);
    const devs = [mk('aa', base), mk('bb', base), mk('cc', base)];
    for (let i = 0; i < 20; i++) randomOp(devs[Math.floor(r() * 3)], r, i);
    edit(devs[1], (p) => { p.aboutMe = { ...p.aboutMe, text: 'Only B wrote this' }; });
    let file = structuredClone(devs[0].data);
    for (let k = 0; k < 2; k++) for (const d of devs) { pull(d, file); file = structuredClone(d.data); }
    for (const d of devs) expect(d.data.profiles[0].aboutMe.text).toBe('Only B wrote this');
  });
});

// ---------------------------------------------------------------- files, crypto, passcodes

describe('sync files v2', () => {
  it('round-trips, keeps names private and authenticates the header', async () => {
    const d = structuredClone(base);
    d.grownUpLock = { lock: 'pin', pin: '4321' };
    d.profiles[0].boards.home.cells[0] = btn('SECRETWORD');
    d.profiles[0].settings.gazeCalibration = [[1, 2, 3]];
    const pass = suggestPasscode();
    const text = await (await createSyncFile(d, [d.profiles[0].id], pass)).text();
    expect(text).not.toContain('SECRETWORD');
    const { data: _cipher, ...header } = JSON.parse(text);
    expect(JSON.stringify(header)).not.toContain('Sam'); // no names in the plaintext header
    const f = peekSyncFile(text);
    expect(f.v).toBe(2);
    if (f.v !== 2) return;
    expect(f.iter).toBe(250000);
    expect(f.kdf).toBe('PBKDF2-SHA256');
    // Typing it in lower case with spaces still works.
    const opened = await openSyncFile(f, pass.toLowerCase().replace(/-/g, ' '));
    expect(opened.data.profiles[0].boards.home.cells[0]!.label).toBe('SECRETWORD');
    expect(opened.data.profiles[0].settings.gazeCalibration).toBeUndefined();
    expect(opened.data.grownUpLock?.pin).toBeUndefined(); // the lock never travels
    await expect(openSyncFile(f, 'WRONG-PASS-CODE')).rejects.toThrow(/Wrong passcode/);
    // Changing any header field breaks it.
    await expect(openSyncFile({ ...f, createdAt: '2001-01-01T00:00:00.000Z' }, pass)).rejects.toThrow(/Wrong passcode|changed/);
    await expect(openSyncFile({ ...f, iter: 300000 }, pass)).rejects.toThrow();
  }, 30000);

  it('rejects absurd iteration counts and short passcodes', async () => {
    await expect(unseal({ salt: b64(new Uint8Array(16)), iv: b64(new Uint8Array(12)), data: 'AAAA', iter: 1e12 }, 'x')).rejects.toThrow(/damaged/);
    await expect(buildSyncText(base, 'short')).rejects.toThrow();
  });

  it('tolerates leftover bytes after the file (a provider that did not truncate)', () => {
    const t = JSON.stringify({ app: 'caleb', kind: 'sync', v: 2, a: '}{"' }) + '"tail": 1}}} garbage';
    expect((parseLeadingJSON(t) as { a: string }).a).toBe('}{"');
  });

  it('encrypted backups now record their iteration count and old ones still open', async () => {
    const text = await (await createBackup(base, { passcode: 'family-pass-1' })).text();
    expect(JSON.parse(text).iter).toBe(250000);
    const f = JSON.parse(text);
    delete f.iter; delete f.kdf; // what a v0.4 file looks like
    expect(JSON.parse(await decryptBackup(JSON.stringify(f), 'family-pass-1')).app).toBe('caleb');
  }, 30000);
});

describe('passcodes (defect 31)', () => {
  it('generated passcodes have at least 50 bits and are easy to read', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = suggestPasscode();
      expect(p).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
    expect(12 * Math.log2(31)).toBeGreaterThan(50);
  });
  it('normalises case, spaces and dashes', () => {
    expect(normalizePasscode(' k7qm-4xtr 9pwd ')).toBe('K7QM4XTR9PWD');
  });
  it('gives a strength hint for typed passcodes', () => {
    expect(passcodeStrength('abc').level).toBe('short');
    expect(passcodeStrength('aaaaaaaa').level).toBe('weak');
    // Every suggested passcode is rated strong (it used to fail now and then for all-letter codes).
    for (let i = 0; i < 500; i++) expect(passcodeStrength(suggestPasscode()).level).toBe('strong');
    expect(passcodeStrength('ABCD-EFGH-JKMN').level).toBe('strong');
    expect(passcodeStrength('Tiger lemon 41 piano!').level).toBe('strong');
  });
});
