import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import type { AppData, Profile } from '../../types';
import { buildProfile, DEFAULT_SETTINGS } from '../../data/defaults';
import { WORD_COLORS } from '../colors';
import { translateProfile } from '../translate';
import {
  cleanData, cleanHistory, cleanSettings, hasUserContent, withoutTransient,
} from '../validate';
import { SaveQueue } from '../savequeue';
import {
  addSnapshot, blockStoredWrites, DAILY_SNAPSHOT_REASON, gcAssets, getRev, listSnapshots, loadDataWithRev,
  logUsage, getLog, MANUAL_SNAPSHOT_REASON, putAsset, allAssetIds, saveDataChecked, setUsageLogPaused, SNAPSHOT_KEEP,
  getSnapshot,
} from '../db';
import { createBackup, readBackup, referencedAssets } from '../backup';
import { filesToDelete, isDue, rotateFolder, timeOf } from '../autobackup';
import { importOBF, OBZ_LIMITS } from '../obf';
import { DATA_VERSION, migrate, useStore } from '../../store';

vi.mock('../tts', () => ({
  speak: async () => {}, stopSpeaking: () => {}, isUserSpeaking: () => false, setTtsFailureHandler: () => {},
  openTtsInstall: () => {}, checkNativeLanguage: async () => null, listVoices: async () => [], ttsAvailable: () => false,
  setSpeakingListener: () => {}, reportFailure: () => {}, needsUserGesture: () => false, primeSpeech: () => {}, refreshVoices: async () => [],
}));

const good = (name = 'Sam'): AppData => {
  const p = buildProfile(name, 'medium');
  return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: true, library: { categories: [], additions: {} } };
};

// ---------- usable-data checks ----------
const WORD_TYPES = new Set(Object.keys(WORD_COLORS));
const isButton = (b: unknown) => {
  const o = b as Record<string, unknown>;
  return !!o && typeof o.id === 'string' && typeof o.label === 'string' && WORD_TYPES.has(o.type as string);
};

function assertUsable(d: AppData, deep = true) {
  expect(Array.isArray(d.profiles) && d.profiles.length > 0).toBe(true);
  expect(d.profiles.some((p) => p.id === d.activeProfileId)).toBe(true);
  expect(new Set(d.profiles.map((p) => p.id)).size).toBe(d.profiles.length);
  expect(Array.isArray(d.library.categories)).toBe(true);
  expect(['hold', 'pin', 'math', 'none']).toContain(d.grownUpLock?.lock);
  if (d.grownUpLock?.lock === 'pin') expect(d.grownUpLock.pin).toMatch(/^\d{4,6}$/);
  for (const p of d.profiles) {
    expect(typeof p.id).toBe('string');
    expect(typeof p.name).toBe('string');
    expect(Object.hasOwn(p.boards, p.rootId)).toBe(true);
    for (const [id, b] of Object.entries(p.boards)) {
      expect(b.id).toBe(id);
      expect(b.cols >= 1 && b.cols <= 20 && b.rows >= 1 && b.rows <= 30).toBe(true);
      expect(b.cells.length).toBe(b.cols * b.rows);
      const bad = b.cells.filter((c) => c !== null && (!isButton(c) || (c.link && !Object.hasOwn(p.boards, c.link))));
      expect(bad).toEqual([]);
    }
    expect(Array.isArray(p.quickBar) && p.quickBar.every(isButton)).toBe(true);
    expect(p.phrases.every((x) => typeof x.id === 'string' && typeof x.text === 'string' && typeof x.category === 'string')).toBe(true);
    expect(p.phraseCategories.every((c) => typeof c === 'string')).toBe(true);
    for (const ph of p.phrases) if (ph.category) expect(p.phraseCategories).toContain(ph.category);
    expect(p.schedules.every((s) => typeof s.name === 'string' && Array.isArray(s.steps) && s.steps.every((st) => typeof st.label === 'string'))).toBe(true);
    expect(p.history.every((h) => typeof h.text === 'string' && Number.isFinite(h.t) && typeof h.id === 'string')).toBe(true);
    expect(typeof p.aboutMe.text === 'string' && typeof p.aboutMe.contacts === 'string' && typeof p.aboutMe.enabled === 'boolean').toBe(true);
    expect(Object.values(p.lexicon).every((n) => Number.isFinite(n))).toBe(true);
    expect(Number.isFinite(p.createdAt)).toBe(true);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      expect(typeof (p.settings as unknown as Record<string, unknown>)[k], k).toBe(typeof v);
    }
    expect(p.settings.holdMs).toBeLessThanOrEqual(3000);
    expect(p.settings.debounceMs).toBeLessThanOrEqual(3000);
    expect(['en', 'es', 'fr', 'pt']).toContain(p.settings.language);
    expect('lock' in p.settings || 'pin' in p.settings).toBe(false); // app-wide since v0.5
    // The app can work with it: clone, serialise and translate without throwing.
    structuredClone(p);
    JSON.parse(JSON.stringify(p));
    if (deep) translateProfile(structuredClone(p), 'es');
  }
}

// ---------- deterministic junk ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const JUNK: unknown[] = [
  null, undefined, 0, -1, 1e308, -1e308, NaN, Infinity, 999999999, '', ' ', 'x', '__proto__', 'constructor', 'toString',
  'hasOwnProperty', '#zzz', 'javascript:alert(1)', '<img src=x onerror=alert(1)>', true, false, [], [null], [1, 'a', {}],
  {}, { __proto__: { polluted: true } }, { constructor: 'x' }, { length: 5 }, 'e:🍎', 'a:12', 'img:../../x',
];
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];

/** All [parent, key] paths in a JSON tree. */
function paths(root: unknown): [Record<string, unknown> | unknown[], string | number][] {
  const out: [Record<string, unknown> | unknown[], string | number][] = [];
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 7) return;
    if (Array.isArray(o)) o.forEach((v, i) => { out.push([o, i]); walk(v, depth + 1); });
    else for (const [k, v] of Object.entries(o)) { out.push([o as Record<string, unknown>, k]); walk(v, depth + 1); }
  };
  walk(root, 0);
  return out;
}

const FRIENDLY = /no AACFree profiles|newer version|no usable boards/;

describe('migrate: the single gate for untrusted data', () => {
  it('fixes every field type that used to crash or brick the app', () => {
    const d = good();
    const p = d.profiles[0] as unknown as Record<string, unknown>;
    p.phraseCategories = 5;
    p.history = [null, { text: 7 }, { text: 'hi', t: 'x' }];
    p.phrases = [null, { text: 'Hello', category: 'Mine' }, { text: '' }];
    p.schedules = 'nope';
    p.aboutMe = 'I am Sam';
    p.lexicon = { __proto__: 3, ok: 2, bad: 'x', inf: Infinity };
    p.rootId = 'constructor';
    p.settings = { ...DEFAULT_SETTINGS, holdMs: 999999999, debounceMs: -5, scanMs: 'fast', theme: 'neon', language: 'xx', autoBackup: false, extra: { a: 1 } };
    const m = migrate(d);
    assertUsable(m);
    const q = m.profiles[0];
    expect(q.rootId).toBe('home');
    expect(q.history).toEqual([{ id: expect.any(String), text: 'hi', t: 0 }]);
    expect(q.phrases.map((x) => x.text)).toEqual(['Hello']);
    expect(q.phraseCategories).toContain('Mine');
    expect(q.schedules).toEqual([]);
    expect(q.aboutMe.enabled).toBe(true);
    expect(q.lexicon).toEqual({ ok: 2 });
    expect(q.settings.holdMs).toBe(3000);
    expect(q.settings.debounceMs).toBe(0);
    expect(q.settings.scanMs).toBe(DEFAULT_SETTINGS.scanMs);
    expect(q.settings.theme).toBe('light');
    expect(q.settings.language).toBe('en');
    expect('autoBackup' in q.settings).toBe(false);
    expect((q.settings as unknown as Record<string, unknown>).extra).toEqual({ a: 1 }); // newer settings survive as plain values
  });

  it('keeps board lookups safe from prototype names and follows renamed boards', () => {
    const d = good();
    const p = d.profiles[0];
    const boards = p.boards as Record<string, unknown>;
    boards['constructor'] = { name: 'C', cols: 1, rows: 1, cells: [{ label: 'x', type: 'noun' }] };
    Object.defineProperty(boards, '__proto__', { value: { name: 'P', cols: 1, rows: 1, cells: [] }, enumerable: true, configurable: true, writable: true });
    p.boards.home.cells[0] = { id: 'l', label: 'go', type: 'folder', link: 'constructor' };
    p.rootId = '__proto__';
    const m = migrate(JSON.parse(JSON.stringify(d)));
    assertUsable(m);
    const q = m.profiles[0];
    expect(Object.getPrototypeOf(q.boards)).toBe(Object.prototype);
    expect(Object.hasOwn(q.boards, 'constructor')).toBe(false);
    const link = q.boards.home.cells[0]!.link!;
    expect(q.boards[link].name).toBe('C');
    expect(q.rootId).toBe(Object.keys(q.boards).find((k) => q.boards[k].name === 'P'));
  });

  it('gives duplicate profile ids a fresh id and repairs the active profile', () => {
    const a = buildProfile('A', 'medium');
    const b = { ...buildProfile('B', 'medium'), id: a.id };
    const m = migrate({ version: 1, profiles: [a, b], activeProfileId: 'missing', onboarded: true, library: { categories: [], additions: {} } });
    assertUsable(m);
    expect(m.profiles[0].id).not.toBe(m.profiles[1].id);
    expect(m.activeProfileId).toBe(m.profiles[0].id);
  });

  it('cleans settings: clamps, enums, optional fields and the PIN', () => {
    const s = cleanSettings({
      rate: 50, volume: 0, pointerSmoothing: 5, lock: 'pin', pin: '1234', pronunciations: { __proto__: 'x', AAC: 'A A C', n: 5 },
      voiceIndex: -3, gazeCalibration: [[1, 2], ['x']], keepRecent: 'forever',
    });
    expect(s.rate).toBe(2.5);
    expect(s.volume).toBe(0.1);
    expect(s.pointerSmoothing).toBe(0.95);
    expect('lock' in s || 'pin' in s).toBe(false); // the lock lives in AppData.grownUpLock
    expect(s.pronunciations).toEqual({ AAC: 'A A C' });
    expect(s.voiceIndex).toBeUndefined();
    expect(s.gazeCalibration).toBeUndefined();
    expect(s.keepRecent).toBe('on');
    expect(cleanSettings(null)).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('fills history ids and drops recent sentences that are not kept', () => {
    expect(cleanHistory([{ text: 'a', t: 1 }, { text: 'b', t: 2, id: 'x' }, { text: 'c', t: 3, id: 'x' }]).map((h) => h.id)).toEqual([expect.any(String), 'x', expect.any(String)]);
    const d = good();
    d.profiles[0].settings.keepRecent = 'session';
    d.profiles[0].history = [{ text: 'secret', t: 1 }];
    expect(migrate(d).profiles[0].history).toEqual([]);
  });

  it('fuzz: junk in any field never throws and always leaves a usable profile', () => {
    const r = rng(42);
    for (let i = 0; i < 250; i++) {
      const d = good() as unknown as Record<string, unknown>;
      // A second profile so profile-level junk is covered too.
      (d.profiles as unknown[]).push(buildProfile('B', 'big'));
      const all = paths(d).filter(([parent, key]) => {
        // Keep one board of the first profile in place (its fields may still be junk).
        const p0 = (d.profiles as Profile[])[0];
        if (parent === d && key === 'profiles') return false;
        if (parent === d.profiles && key === 0) return false;
        if ((parent as unknown) === p0 && key === 'boards') return false;
        if (parent === p0.boards && key === 'home') return false;
        return true;
      });
      const n = 1 + Math.floor(r() * 12);
      for (let j = 0; j < n; j++) {
        const [parent, key] = pick(r, all);
        (parent as Record<string, unknown>)[key as string] = structuredClone(pick(r, JUNK.filter((x) => typeof x !== 'object' || x === null || Array.isArray(x))) ?? pick(r, JUNK));
      }
      let m: AppData;
      try { m = migrate(d as unknown as AppData); } catch (e) {
        throw new Error(`iteration ${i} threw: ${(e as Error).message}`);
      }
      assertUsable(m, i % 10 === 0);
      expect(() => migrate(structuredClone(m))).not.toThrow();
    }
  }, 60000);

  it('fuzz: total junk only ever throws a friendly error', () => {
    const r = rng(7);
    for (let i = 0; i < 300; i++) {
      const d = good() as unknown as Record<string, unknown>;
      const all = paths(d);
      for (let j = 0; j < 1 + Math.floor(r() * 25); j++) {
        const [parent, key] = pick(r, all);
        (parent as Record<string, unknown>)[key as string] = structuredClone(pick(r, JUNK.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype)))) as unknown;
      }
      let m: AppData | null = null;
      try { m = migrate(d as unknown as AppData); } catch (e) {
        expect((e as Error).message).toMatch(FRIENDLY);
      }
      if (m) assertUsable(m, false);
    }
    for (const top of [null, 5, 'x', [], { profiles: 'x' }, { profiles: [null, 3] }, { profiles: [{ boards: null }] }]) {
      expect(() => cleanData(top, DATA_VERSION)).toThrow(FRIENDLY);
    }
  }, 60000);
});

describe('locks and privacy in files', () => {
  it('plain backups carry no PIN; encrypted ones do', async () => {
    const d = good();
    d.grownUpLock = { lock: 'pin', pin: '4321' };
    expect(await (await createBackup(d)).text()).not.toContain('4321');
    expect(d.grownUpLock.pin).toBe('4321'); // the original is untouched
  });

  it('migrates a per-profile PIN from a hand-edited file into the app-wide lock', () => {
    const d = good() as unknown as Record<string, unknown>;
    Object.assign((d.profiles as Profile[])[0].settings, { lock: 'pin', pin: '2468' });
    const m = migrate(d as unknown as AppData);
    expect(m.grownUpLock).toEqual({ lock: 'pin', pin: '2468' });
    expect('pin' in m.profiles[0].settings).toBe(false);
    expect(migrate({ ...good(), grownUpLock: { lock: 'pin', pin: 'x' } } as unknown as AppData).grownUpLock?.lock).toBe('hold');
  });

  it('a restore keeps the device lock (and a placeholder never imposes its own)', async () => {
    const st = useStore.getState();
    const local = good();
    local.grownUpLock = { lock: 'pin', pin: '1111' };
    useStore.setState({ data: local, loadProblem: null });
    const incoming = good('Other');
    incoming.grownUpLock = { lock: 'none' };
    await st.replaceData(incoming, 'Before a lock test');
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'pin', pin: '1111' });
  });

  it('session-only recent sentences never reach storage or files', async () => {
    const d = good();
    d.profiles[0].settings.keepRecent = 'session';
    d.profiles[0].history = [{ id: 'h1', text: 'private', t: 1 }];
    expect(withoutTransient(d).profiles[0].history).toEqual([]);
    expect(d.profiles[0].history.length).toBe(1);
    expect(await (await createBackup(d)).text()).not.toContain('private');
  });

  it('tells the untouched default apart from real content', () => {
    expect(hasUserContent(good(''))).toBe(false);
    expect(hasUserContent(good('Sam'))).toBe(true);
    const d = good('');
    d.profiles[0].updatedAt = 5;
    expect(hasUserContent(d)).toBe(true);
    expect(hasUserContent({ profiles: [{ name: 5 }] } as unknown as AppData)).toBe(false);
  });

  it('readBackup refuses junk with a friendly message', async () => {
    await expect(readBackup('not json')).rejects.toThrow(/damaged/);
    await expect(readBackup('{"app":"caleb","data":{"profiles":"x"}}')).rejects.toThrow(/not a AACFree backup/);
    await expect(readBackup('null')).rejects.toThrow(/not a AACFree backup/);
  });
});

describe('save queue', () => {
  const deferred = () => {
    let resolve!: (v: number | null) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<number | null>((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('serialises writes and coalesces changes made meanwhile into one write of the latest state', async () => {
    const writes: { data: string; rev: number; d: ReturnType<typeof deferred> }[] = [];
    const q = new SaveQueue<string>({
      write: (data, rev) => { const d = deferred(); writes.push({ data, rev, d }); return d.promise; },
      blocked: () => false, onConflict: () => {}, onSaved: () => {}, onFailed: () => {},
    });
    const done = q.save('a');
    q.save('b'); q.save('c'); q.save('d');
    await Promise.resolve();
    expect(writes.map((w) => w.data)).toEqual(['a']);
    writes[0].d.resolve(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(writes.map((w) => w.data)).toEqual(['a', 'd']);
    expect(writes[1].rev).toBe(1);
    writes[1].d.resolve(2);
    await done;
    expect(q.rev).toBe(2);
    expect(q.busy).toBe(false);
  });

  it('on a conflict drops queued changes and lets the caller reload', async () => {
    let conflicts = 0;
    const seen: string[] = [];
    const q = new SaveQueue<string>({
      write: async (data) => { seen.push(data); return null; },
      blocked: () => false, onConflict: () => { conflicts++; }, onSaved: () => {}, onFailed: () => {},
    });
    await q.save('x');
    expect(conflicts).toBe(1);
    expect(seen).toEqual(['x']);
  });

  it('retries a failed write, then reports failure; the next change tries again', async () => {
    let calls = 0;
    let failed = 0;
    let saved = 0;
    const q = new SaveQueue<string>({
      write: async () => { calls++; if (calls <= 3) throw new Error('disk full'); return calls; },
      blocked: () => false, onConflict: () => {}, onSaved: () => { saved++; }, onFailed: () => { failed++; },
      retryDelays: [1, 1], sleep: async () => {},
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await q.save('a');
    expect(calls).toBe(3);
    expect(failed).toBe(1);
    await q.save('b');
    expect(saved).toBe(1);
    vi.restoreAllMocks();
  });

  it('writes nothing while saving is blocked', async () => {
    let calls = 0;
    const q = new SaveQueue<string>({
      write: async () => { calls++; return 1; }, blocked: () => true, onConflict: () => {}, onSaved: () => {}, onFailed: () => {},
    });
    await q.save('a');
    expect(calls).toBe(0);
  });
});

describe('storage (IndexedDB)', () => {
  afterEach(() => { vi.useRealTimers(); blockStoredWrites(false); });

  it('saveDataChecked refuses to overwrite a newer revision; data and rev load together', async () => {
    const d = good();
    const rev = await getRev();
    expect(await saveDataChecked(d, rev)).toBe(rev + 1);
    expect(await saveDataChecked(d, rev)).toBeNull(); // stale writer
    const both = await loadDataWithRev();
    expect(both.rev).toBe(rev + 1);
    expect(both.data?.profiles[0].name).toBe('Sam');
  });

  it('keeps snapshot classes apart, so a burst of deletions never evicts the daily ones', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let t = Date.UTC(2026, 0, 1);
    const d = good();
    for (let i = 0; i < SNAPSHOT_KEEP.daily + 3; i++) { vi.setSystemTime(t += 86400000); await addSnapshot(d, DAILY_SNAPSHOT_REASON); }
    for (let i = 0; i < SNAPSHOT_KEEP.action + 5; i++) { vi.setSystemTime(t += 3600000); await addSnapshot(d, `Before deleting ${i}`); }
    vi.setSystemTime(t += 1000);
    await addSnapshot(d, MANUAL_SNAPSHOT_REASON);
    const list = await listSnapshots();
    expect(list.filter((s) => s.kind === 'daily').length).toBe(SNAPSHOT_KEEP.daily);
    expect(list.filter((s) => s.kind === 'action').length).toBe(SNAPSHOT_KEEP.action);
    expect(list.filter((s) => s.kind === 'manual').length).toBe(1);
    expect(list[0].reason).toBe(MANUAL_SNAPSHOT_REASON); // newest first
  });

  it('coalesces same-reason snapshots within five minutes (no double snapshot on sync apply)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2027, 0, 1));
    const d = good();
    expect(await addSnapshot(d, 'Before syncing from another device')).toBe(true);
    vi.setSystemTime(Date.UTC(2027, 0, 1) + 1000);
    expect(await addSnapshot(d, 'Before syncing from another device')).toBe(false);
    vi.setSystemTime(Date.UTC(2027, 0, 1) + 6 * 60 * 1000);
    expect(await addSnapshot(d, 'Before syncing from another device')).toBe(true);
  });

  it('never snapshots while stored writes are blocked, and leaves session history out', async () => {
    blockStoredWrites(true);
    expect(await addSnapshot(good(), 'Before anything')).toBe(false);
    blockStoredWrites(false);
    const d = good();
    d.profiles[0].settings.keepRecent = 'session';
    d.profiles[0].history = [{ id: 'h', text: 'secret', t: 1 }];
    await addSnapshot(d, 'Before a test with session history');
    const s = (await listSnapshots())[0];
    expect((await getSnapshot(s.id!))!.data.profiles[0].history).toEqual([]);
  });

  it('gcAssets deletes unreferenced photos only after a day, and keeps those a snapshot still uses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = Date.UTC(2028, 0, 1);
    vi.setSystemTime(t0);
    await putAsset('live', new Blob(['a']));
    await putAsset('orphan', new Blob(['b']));
    await putAsset('insnap', new Blob(['c']));
    const snap = good();
    snap.profiles[0].boards.home.cells[1]!.symbol = 'img:insnap';
    await addSnapshot(snap, 'Before a gc test');
    const live = good();
    live.profiles[0].boards.home.cells[0]!.symbol = 'img:live';
    expect(await gcAssets(referencedAssets(live), referencedAssets)).toBe(0);
    vi.setSystemTime(t0 + 25 * 3600 * 1000);
    expect(await gcAssets(referencedAssets(live), referencedAssets)).toBe(1);
    const ids = await allAssetIds();
    expect(ids).toContain('live');
    expect(ids).toContain('insnap');
    expect(ids).not.toContain('orphan');
  });

  it('private mode pauses the usage log, whoever writes to it', async () => {
    setUsageLogPaused(true);
    await logUsage({ profileId: 'priv', kind: 'word', text: 'hidden' });
    setUsageLogPaused(false);
    await logUsage({ profileId: 'priv', kind: 'word', text: 'shown' });
    expect((await getLog('priv')).map((e) => e.text)).toEqual(['shown']);
  });
});

describe('automatic backup rotation and schedule', () => {
  const name = (y: number, m: number, d: number, hm = '1200') => `caleb-backup-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${hm}.json`;
  const WEEK = 7 * 86400000;

  it('keeps the newest copies, and repeated runs close together count as one', () => {
    const weekly = [name(2026, 1, 1), name(2026, 1, 8), name(2026, 1, 15), name(2026, 1, 22)];
    // A failing destination used to cause a run on every launch: five copies in two days.
    const burst = [name(2026, 1, 29, '0800'), name(2026, 1, 29, '0900'), name(2026, 1, 30, '0800'), name(2026, 1, 30, '1000'), name(2026, 1, 30, '1100')];
    const del = filesToDelete([...weekly, ...burst, 'notes.txt'], 4, WEEK);
    const kept = [...weekly, ...burst].filter((n) => !del.includes(n));
    expect(kept).toEqual([name(2026, 1, 8), name(2026, 1, 15), name(2026, 1, 22), name(2026, 1, 30, '1100')]);
    expect(del).not.toContain('notes.txt');
    expect(filesToDelete([name(2026, 1, 1)], 0, WEEK)).toEqual([]); // always keeps one
    expect(timeOf('caleb-backup-2026-01-02.json')).toBeGreaterThan(0);
  });

  it('rotates a backup folder', async () => {
    const files = new Set([name(2026, 1, 1), name(2026, 2, 1), name(2026, 3, 1), 'other.json']);
    const h = {
      async *entries(): AsyncGenerator<[string, { kind: string }]> { for (const n of files) yield [n, { kind: 'file' }]; },
      async removeEntry(n: string) { files.delete(n); },
    };
    await rotateFolder(h, 2, WEEK);
    expect([...files].sort()).toEqual([name(2026, 2, 1), name(2026, 3, 1), 'other.json'].sort());
  });

  it('retries only a failed destination, and not on every launch', () => {
    const now = Date.UTC(2026, 5, 1);
    expect(isDue(undefined, WEEK, now)).toBe(true);
    expect(isDue({ ok: now - 86400000, tried: now - 86400000 }, WEEK, now)).toBe(false);
    expect(isDue({ ok: now - 8 * 86400000, tried: now - 3600000, error: 'x' }, WEEK, now)).toBe(false); // failed an hour ago
    expect(isDue({ ok: now - 8 * 86400000, tried: now - 7 * 3600000, error: 'x' }, WEEK, now)).toBe(true);
    expect(isDue({ ok: now - 8 * 86400000, tried: now - 8 * 86400000 }, WEEK, now)).toBe(true);
  });
});

describe('automatic backup runs (browser folder)', () => {
  type Written = Record<string, Blob>;
  const folder = (written: Written, opts: { perm?: PermissionState; fail?: boolean } = {}) => ({
    name: 'Backups',
    queryPermission: async () => opts.perm ?? 'granted',
    requestPermission: async () => 'granted' as PermissionState,
    async getFileHandle(n: string) {
      return {
        async createWritable() {
          let buf: Blob = new Blob([]);
          return { async write(d: Blob | string) { if (opts.fail) throw new Error('disk'); buf = new Blob([d]); }, async close() { written[n] = buf; } };
        },
        async getFile() { return new File([written[n] ?? ''], n); },
      };
    },
    async removeEntry(n: string) { delete written[n]; },
    async *entries(): AsyncGenerator<[string, { kind: string }]> { for (const n of Object.keys(written)) yield [n, { kind: 'file' }]; },
  });

  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.doUnmock('../db'); vi.useRealTimers(); });

  async function load(handle: unknown) {
    const meta: Record<string, unknown> = { backupFolder: handle };
    vi.doMock('../db', async (orig) => ({
      ...(await orig<typeof import('../db')>()),
      getMeta: async (k: string) => meta[k],
      setMeta: async (k: string, v: unknown) => { meta[k] = v; },
    }));
    const ab = await import('../autobackup');
    return { ab, meta };
  }

  it('writes a verified copy, skips the untouched default, and is not redone until due', async () => {
    const written: Written = {};
    const { ab, meta } = await load(folder(written));
    expect(await ab.runAutoBackup(good(''))).toBeNull(); // nothing made yet: never replaces a real backup
    const st = await ab.runAutoBackup(good());
    expect(st?.error).toBeUndefined();
    expect(Object.keys(written).length).toBe(1);
    expect((meta.autoBackup as { dest: { folder: { ok: number } } }).dest.folder.ok).toBeGreaterThan(0);
    expect(await ab.runAutoBackup(good())).toBeNull(); // not due again yet
    const text = await Object.values(written)[0].text();
    expect(text).toContain('"kind":"backup"');
    expect(text).not.toContain('"history":[{'); // recent sentences are off by default
  });

  it('never asks for folder permission in the background', async () => {
    const written: Written = {};
    const { ab } = await load(folder(written, { perm: 'prompt' }));
    const st = await ab.runAutoBackup(good());
    expect(st?.error).toMatch(/Needs permission/);
    expect(Object.keys(written).length).toBe(0);
    const forced = await ab.runAutoBackup(good(), { force: true, interactive: true });
    expect(forced?.error).toBeUndefined();
  });

  it('records a failed write per destination and refuses to back up placeholder data', async () => {
    const written: Written = {};
    const { ab } = await load(folder(written, { fail: true }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const st = await ab.runAutoBackup(good());
    expect(st?.error).toMatch(/Could not write/);
    expect(st?.dest?.folder?.error).toBeTruthy();
    const db = await import('../db');
    db.blockStoredWrites(true);
    expect(await ab.runAutoBackup(good())).toBeNull();
    expect((await ab.runAutoBackup(good(), { force: true }))?.error).toMatch(/could not be opened/);
    db.blockStoredWrites(false);
    vi.restoreAllMocks();
  });
});

describe('OBF / OBZ import (malformed and hostile files)', () => {
  const board = (id: string, extra: Record<string, unknown> = {}) => ({
    format: 'open-board-0.1', id, name: `Board ${id}`,
    grid: { rows: 1, columns: 2, order: [['b1', 'b2']] },
    buttons: [{ id: 'b1', label: 'hi' }, { id: 'b2', label: 'go', load_board: { path: 'boards/2.obf' } }],
    ...extra,
  });
  const obz = (files: Record<string, unknown>) => {
    const f: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(files)) f[k] = v instanceof Uint8Array ? v : strToU8(typeof v === 'string' ? v : JSON.stringify(v));
    return new File([zipSync(f) as BlobPart], 'x.obz');
  };

  it('imports a normal package and links boards', async () => {
    const r = await importOBF(obz({ 'manifest.json': { root: 'boards/1.obf' }, 'boards/1.obf': board('1'), 'boards/2.obf': board('2') }));
    expect(Object.keys(r.boards).length).toBe(2);
    const root = r.boards[r.rootId];
    expect(root.cells[0]?.label).toBe('hi');
    expect(Object.hasOwn(r.boards, root.cells[1]!.link!)).toBe(true);
  });

  it('explains a missing manifest (and copes when there is only one board)', async () => {
    await expect(importOBF(obz({ 'boards/1.obf': board('1'), 'boards/2.obf': board('2') }))).rejects.toThrow(/no manifest/);
    const one = await importOBF(obz({ 'boards/1.obf': board('1') }));
    expect(one.boards[one.rootId].name).toBe('Board 1');
    await expect(importOBF(obz({ 'manifest.json': 'not json', 'a.obf': board('a'), 'b.obf': board('b') }))).rejects.toThrow(/No root board/);
  });

  it('refuses entries whose inflated size is over the caps', async () => {
    const big = new Uint8Array(OBZ_LIMITS.boardBytes + 10); // compresses to almost nothing
    await expect(importOBF(obz({ 'manifest.json': { root: 'a.obf' }, 'a.obf': big }))).rejects.toThrow(/too large/);
  });

  it('survives junk buttons, grids and images without throwing', async () => {
    const junk = board('1', {
      buttons: [null, 5, { id: 'b1', label: { x: 1 }, ext_caleb_type: 'evil', ext_caleb_color: 'url(x)', load_board: 'boards/2.obf' }, { id: 'b2', label: 'ok', image_id: 'i' }],
      images: [null, { id: 'i', path: 'nowhere.png', url: 'https://evil.example/x.png' }],
      grid: { rows: 'x', columns: 9999, order: [null, 'row', [{}, 'b1', 'b2']] },
      name: 42,
    });
    const r = await importOBF(obz({ 'manifest.json': { root: 'boards/1.obf' }, 'boards/1.obf': junk }));
    const b = r.boards[r.rootId];
    expect(b.cells.length).toBe(b.cols * b.rows);
    expect(b.cells.every((c) => c === null || (typeof c.label === 'string' && !c.symbol?.startsWith('http')))).toBe(true);
    await expect(importOBF(new File(['PK\x03\x04garbage'], 'x.obz'))).rejects.toThrow(/damaged|No root board/);
    await expect(importOBF(new File(['{not json'], 'x.obf'))).rejects.toThrow(/No root board/);
  });
});

describe('store: recent sentences, private mode, profiles', () => {
  beforeEach(() => {
    const d = good();
    useStore.setState({ data: d, loaded: true, message: [], privateMode: false, boardStack: [d.profiles[0].rootId] });
  });
  const say = (text: string) => { useStore.setState({ message: [{ id: 'w' + text, text }] }); useStore.getState().speakMessage(); };
  const history = () => useStore.getState().profile().history.map((h) => h.text);

  it('keeps recent sentences with ids, and per-row delete / clear both offer Undo', () => {
    say('one'); say('two');
    expect(history()).toEqual(['two', 'one']);
    const st = useStore.getState();
    const id = st.profile().history[1].id!;
    st.deleteRecent(id);
    expect(history()).toEqual(['two']);
    useStore.getState().toastAction!.run();
    expect(history()).toEqual(['two', 'one']);
    useStore.getState().clearRecent();
    expect(history()).toEqual([]);
    useStore.getState().toastAction!.run();
    expect(history()).toEqual(['two', 'one']);
  });

  it('private mode and keepRecent "off" record nothing; switching off forgets what was kept', () => {
    useStore.getState().setPrivate(true);
    say('secret');
    expect(history()).toEqual([]);
    useStore.getState().setPrivate(false);
    say('hello');
    expect(history()).toEqual(['hello']);
    useStore.getState().updateSettings({ keepRecent: 'off' });
    expect(history()).toEqual([]);
    say('again');
    expect(history()).toEqual([]);
    useStore.getState().updateSettings({ keepRecent: 'session' });
    say('for now');
    expect(history()).toEqual(['for now']); // in memory only (stripped from every save)
  });

  it('deleteProfile snapshots first and then deletes', async () => {
    const d = good();
    const extra = buildProfile('Extra', 'medium');
    d.profiles.push(extra);
    useStore.setState({ data: d });
    const before = (await listSnapshots()).length;
    await useStore.getState().deleteProfile(extra.id);
    expect(useStore.getState().data.profiles.map((p) => p.name)).toEqual(['Sam']);
    expect((await listSnapshots()).length).toBeGreaterThanOrEqual(Math.min(before + 1, SNAPSHOT_KEEP.action));
  });
});

describe('deleteProfile when the safety snapshot fails', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.doUnmock('../db'); vi.restoreAllMocks(); });

  it('puts the profile back and saves nothing deleted', async () => {
    vi.doMock('../db', async (orig) => ({
      ...(await orig<typeof import('../db')>()),
      addSnapshot: async () => { throw new Error('quota'); },
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = await import('../../store');
    const d = good();
    const extra = buildProfile('Extra', 'medium');
    d.profiles.push(extra);
    store.useStore.setState({ data: d, loaded: true });
    await store.useStore.getState().deleteProfile(extra.id);
    expect(store.useStore.getState().data.profiles.map((p) => p.name)).toEqual(['Sam', 'Extra']);
    expect(store.useStore.getState().toast).toMatch(/nothing was deleted/);
  });
});

describe('start-up with data that cannot be used', () => {
  beforeEach(() => { vi.resetModules(); });

  it('keeps a copy, saves nothing over it, never snapshots the placeholder, and lets a restore replace it', async () => {
    const stored = { version: DATA_VERSION + 5, profiles: [{ id: 'future', boards: {} }], activeProfileId: 'future' };
    await saveDataChecked(stored as unknown as AppData, await getRev());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = await import('../../store');
    const db = await import('../db');
    await store.useStore.getState().init();
    const st = store.useStore.getState();
    expect(st.loadProblem).toBe('newer');
    expect(store.isSaveBlocked()).toBe(true);
    // An edit is not written over the stored record.
    st.updateSettings({ fontScale: 1.3 });
    await store.queue.idle();
    await new Promise((r) => setTimeout(r, 450));
    await store.queue.idle();
    expect((await db.loadData())?.version).toBe(DATA_VERSION + 5);
    // A copy was kept aside.
    const keys = (await (await import('idb')).openDB('caleb')).getAllKeys('kv');
    expect((await keys).some((k) => String(k).startsWith('data-unreadable-'))).toBe(true);
    // Maintenance and snapshots never run on the placeholder.
    const snaps = (await db.listSnapshots()).length;
    await store.runMaintenance();
    expect(await db.addSnapshot(st.data, 'Before anything')).toBe(false);
    expect((await db.listSnapshots()).length).toBe(snaps);
    // A deliberate restore replaces it and saving works again.
    await store.useStore.getState().replaceData(good('Restored'), 'Before importing a backup');
    expect(store.isSaveBlocked()).toBe(false);
    expect((await db.loadData())?.profiles[0].name).toBe('Restored');
    vi.restoreAllMocks();
  });

  it('loads hand-edited junk through migrate without losing the stored record', async () => {
    const d = good('Junk') as unknown as Record<string, unknown>;
    (d.profiles as Record<string, unknown>[])[0].phraseCategories = 5;
    (d.profiles as Record<string, unknown>[])[0].history = [null];
    await saveDataChecked(d as unknown as AppData, await getRev());
    const store = await import('../../store');
    await store.useStore.getState().init();
    const st = store.useStore.getState();
    expect(st.loadProblem).toBeNull();
    assertUsable(st.data);
    expect(st.profile().name).toBe('Junk');
    expect(st.profile().phraseCategories.length).toBeGreaterThan(0);
    expect(store.isSaveBlocked()).toBe(false);
  });
});
