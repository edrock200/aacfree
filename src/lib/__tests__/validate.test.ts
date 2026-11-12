import { describe, expect, it } from 'vitest';
import { cleanBoard, cleanButton, cleanLibrary, safeColor } from '../validate';
import { applyPronunciations, migrate, DATA_VERSION } from '../../store';
import { buildProfile } from '../../data/defaults';
import { buttonColor } from '../colors';
import type { AppData } from '../../types';

describe('validation', () => {
  it('only allows hex colours (blocks style injection)', () => {
    expect(safeColor('#ffcc00')).toBe('#ffcc00');
    expect(safeColor('red;"><script>alert(1)</script>')).toBeUndefined();
    expect(buttonColor('noun', false, 'x" onload="alert(1)')).toBe('#ffd8b0');
  });
  it('cleans buttons and drops junk', () => {
    expect(cleanButton(null)).toBeNull();
    expect(cleanButton({ type: 'verb' })).toBeNull(); // no label
    const b = cleanButton({ id: 'x', label: 'go', type: 'weird', symbol: 'javascript:alert(1)', color: 'url(x)', audio: '../../etc' })!;
    expect(b).toEqual({ id: 'x', label: 'go', type: 'misc' });
  });
  it('repairs board shape (cells length always cols×rows, capped size)', () => {
    const b = cleanBoard({ name: 'B', cols: 999, rows: 'x', cells: [{ label: 'a', type: 'noun' }] }, 'b1')!;
    expect(b.cols).toBe(20);
    expect(b.cells.length).toBe(b.cols * b.rows);
    expect(b.cells[0]?.label).toBe('a');
  });
  it('cleans the symbol library', () => {
    const lib = cleanLibrary({ categories: [{ name: 'X', symbols: [{ label: 'ok', symbol: 'e:⚽' }, { label: 'bad', symbol: 'http://evil' }] }], additions: { a: 'nope' } });
    expect(lib.categories[0].symbols.map((s) => s.label)).toEqual(['ok']);
    expect(lib.additions).toEqual({});
  });
});

describe('migrate (loading saved data / backups)', () => {
  const good = (): AppData => {
    const p = buildProfile('Sam', 'medium');
    return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: true, library: { categories: [], additions: {} } };
  };
  it('accepts good data', () => {
    const d = migrate(good());
    expect(d.profiles[0].name).toBe('Sam');
  });
  it('rejects files with no usable boards instead of bricking the app', () => {
    expect(() => migrate({ onboarded: true, profiles: [{ id: 'x' }] } as unknown as AppData)).toThrow(/no usable boards/);
    expect(() => migrate({} as AppData)).toThrow();
  });
  it('rejects data from a newer version', () => {
    expect(() => migrate({ ...good(), version: DATA_VERSION + 1 })).toThrow(/newer version/);
  });
  it('repairs a missing root board and dangling links', () => {
    const d = good();
    d.profiles[0].rootId = 'nope';
    d.profiles[0].boards.home.cells[0] = { id: 'z', label: 'gone', type: 'folder', link: 'deleted-board' };
    const m = migrate(d);
    expect(m.profiles[0].rootId).toBe('home');
    expect(m.profiles[0].boards.home.cells[0]?.link).toBeUndefined();
  });
  it('never leaves a PIN lock without a PIN', () => {
    const d = good();
    Object.assign(d.profiles[0].settings, { lock: 'pin', pin: undefined }); // pre-v0.5 per-profile lock
    expect(migrate(d).grownUpLock?.lock).toBe('hold');
  });
  it('keeps onboarding state for fresh installs but treats backups without the flag as onboarded', () => {
    expect(migrate({ ...good(), onboarded: false }).onboarded).toBe(false);
    const d = good() as Partial<AppData>;
    delete d.onboarded;
    expect(migrate(d as AppData).onboarded).toBe(true);
  });
});

describe('pronunciations', () => {
  it('replaces whole words only, case-insensitively', () => {
    const m = { Siobhan: 'shi-vawn', AAC: 'A A C' };
    expect(applyPronunciations('Hi siobhan, I use AAC.', m)).toBe('Hi shi-vawn, I use A A C.');
    expect(applyPronunciations('Siobhanna', m)).toBe('Siobhanna');
  });
});

import { fitCalibration } from '../pointer';
describe('eye-gaze calibration', () => {
  it('recovers a linear mapping from features to screen points', () => {
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const fx = Math.random(), fy = Math.random(), nx = Math.random() * 0.1, ny = Math.random() * 0.1;
      samples.push({ f: [1, fx, fy, nx, ny], x: 100 + 800 * fx + 50 * nx, y: 50 + 600 * fy - 30 * ny });
    }
    const cal = fitCalibration(samples)!;
    const f = [1, 0.5, 0.25, 0.05, 0.05];
    const px = cal[0].reduce((s, w, i) => s + w * f[i], 0);
    const py = cal[1].reduce((s, w, i) => s + w * f[i], 0);
    expect(px).toBeCloseTo(100 + 400 + 2.5, 0);
    expect(py).toBeCloseTo(50 + 150 - 1.5, 0);
  });
});
