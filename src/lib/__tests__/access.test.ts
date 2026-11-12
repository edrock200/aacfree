import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore -- @types/node is not installed; vitest runs in Node, where this exists.
import { readFileSync } from 'node:fs';
import { ScanController, advance, choose, highlightOf, keyAction, keyName, startCursor, SETTLE_MS, type Highlight, type ScanConfig } from '../scanner';
import { DwellArming, PointerEngine, checkCalibration, fitCalibration } from '../pointer';
import { RING_THEMES, HIGHLIGHT_COLORS, contrast } from '../rings';
import { WORD_COLORS, COLOR_SWATCHES } from '../colors';
import { backoffMs } from '../../components/LockGate';

/** A fake page: `shape` groups, records what is highlighted and activated. */
function harness(shape: number[], cfg: Partial<ScanConfig> = {}) {
  const log = { shown: [] as (Highlight | null)[], activated: [] as [number, number][] };
  const page = { shape };
  const ctl = new ScanController({
    shape: () => page.shape,
    show: (h) => log.shown.push(h),
    activate: (gi, ii) => log.activated.push([gi, ii]),
    now: () => Date.now(),
  }, cfg);
  const current = () => log.shown[log.shown.length - 1] ?? null;
  return { ctl, log, page, current };
}

describe('scan state machine', () => {
  const cfg = { rowPasses: 2, leaveRow: false };

  it('starts with nothing highlighted, then the first row', () => {
    const c = startCursor();
    expect(highlightOf(c, [3, 2])).toBeNull();
    expect(highlightOf(advance(c, [3, 2], cfg), [3, 2])).toEqual({ kind: 'group', gi: 0 });
  });

  it('a select with nothing highlighted does nothing', () => {
    const c = startCursor();
    expect(choose(c, [3, 2])).toEqual({ cursor: c });
    expect(choose(c, [5])).toEqual({ cursor: c });
  });

  it('row → item → activation', () => {
    let c = advance(startCursor(), [3, 2], cfg); // row 0
    c = advance(c, [3, 2], cfg); // row 1
    const r = choose(c, [3, 2]);
    expect(r.activate).toBeUndefined();
    expect(highlightOf(r.cursor, [3, 2])).toEqual({ kind: 'item', gi: 1, ii: 0 });
    const r2 = choose(advance(r.cursor, [3, 2], cfg), [3, 2]);
    expect(r2.activate).toEqual({ gi: 1, ii: 1 });
  });

  it('a one-item row activates straight away', () => {
    const c = advance(startCursor(), [1, 4], cfg);
    expect(choose(c, [1, 4]).activate).toEqual({ gi: 0, ii: 0 });
  });

  it('goes back to rows after two passes through a row', () => {
    let c = choose(advance(startCursor(), [2, 2], cfg), [2, 2]).cursor;
    for (let i = 0; i < 4; i++) c = advance(c, [2, 2], cfg);
    expect(c.level).toBe('group');
  });

  it('offers a "leave row" step when turned on', () => {
    const lr = { rowPasses: 2, leaveRow: true };
    let c = choose(advance(startCursor(), [2, 2], lr), [2, 2]).cursor;
    c = advance(c, [2, 2], lr);
    c = advance(c, [2, 2], lr);
    expect(highlightOf(c, [2, 2])).toEqual({ kind: 'leave', gi: 0 });
    const r = choose(c, [2, 2]);
    expect(r.activate).toBeUndefined();
    expect(highlightOf(r.cursor, [2, 2])).toEqual({ kind: 'group', gi: 0 });
  });

  it('linear scanning walks every item and counts loops', () => {
    let c = startCursor();
    for (let i = 0; i < 3; i++) c = advance(c, [3], cfg);
    expect(highlightOf(c, [3])).toEqual({ kind: 'item', gi: 0, ii: 2 });
    c = advance(c, [3], cfg);
    expect(c.loop).toBe(1);
    expect(highlightOf(c, [3])).toEqual({ kind: 'item', gi: 0, ii: 0 });
  });

  it('a stale cursor on a smaller page highlights nothing instead of a wrong item', () => {
    const c = { level: 'item' as const, gi: 3, ii: 4, rowPass: 0, loop: 0 };
    expect(highlightOf(c, [2, 2])).toBeNull();
    expect(choose(c, [2, 2]).activate).toBeUndefined();
  });
});

describe('switch keys', () => {
  it('maps default keys by mode', () => {
    expect(keyAction({ key: ' ' }, 'auto')).toBe('select');
    expect(keyAction({ key: ' ' }, 'step')).toBe('next');
    expect(keyAction({ key: 'Enter' }, 'step')).toBe('select');
    expect(keyAction({ key: 'a' }, 'step')).toBeNull();
  });
  it('lets a grown-up assign any key, which wins over the defaults', () => {
    expect(keyAction({ key: '1' }, 'step', { select: '1', next: '2' })).toBe('select');
    expect(keyAction({ key: '2' }, 'step', { select: '1', next: '2' })).toBe('next');
    expect(keyAction({ key: ' ' }, 'step', { select: ' ' })).toBe('select');
    expect(keyAction({ key: 'x', code: 'F13' }, 'auto', { next: 'F13' })).toBe('next');
  });
});

describe('ScanController', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); });

  it('auto mode advances on the timer', () => {
    const { ctl, current } = harness([3, 3, 3], { scanMs: 1000 });
    ctl.start();
    expect(current()).toEqual({ kind: 'group', gi: 0 });
    vi.advanceTimersByTime(1000);
    expect(current()).toEqual({ kind: 'group', gi: 1 });
  });

  it('a held switch (key repeat) selects exactly once', () => {
    const { ctl, log } = harness([3, 3], { scanMs: 1000, lockoutMs: 500 });
    ctl.start();
    ctl.keyDown('Space', 'select'); // row 0 → item 0
    for (let i = 0; i < 30; i++) { vi.advanceTimersByTime(33); ctl.keyDown('Space', 'select', true); }
    expect(log.activated).toEqual([]);
    ctl.keyUp('Space');
    expect(ctl.cursor.level).toBe('item');
  });

  it('a key still down without repeat flags is a new press only after release', () => {
    const { ctl, log } = harness([1, 2], { lockoutMs: 500 });
    ctl.start();
    ctl.keyDown('Enter', 'select');
    expect(log.activated).toEqual([[0, 0]]);
    vi.advanceTimersByTime(2000);
    ctl.keyUp('Enter');
    expect(log.activated.length).toBe(1);
  });

  it('ignores presses during the lockout after an activation, even if the page changes', () => {
    const { ctl, log, page } = harness([1, 4], { lockoutMs: 800 });
    ctl.start();
    ctl.keyDown('k', 'select'); ctl.keyUp('k');
    expect(log.activated).toEqual([[0, 0]]);
    // The activation opened a new board: the hook calls refresh().
    page.shape = [1, 5];
    vi.advanceTimersByTime(100);
    ctl.refresh();
    ctl.keyDown('k', 'select'); ctl.keyUp('k');
    vi.advanceTimersByTime(400);
    ctl.keyDown('k', 'select'); ctl.keyUp('k');
    expect(log.activated.length).toBe(1);
    vi.advanceTimersByTime(400);
    ctl.keyDown('k', 'select'); ctl.keyUp('k');
    expect(log.activated.length).toBe(2);
  });

  it('stops the auto timer on activation and never activates item 0 by accident (linear)', () => {
    const { ctl, log, current } = harness([4], { scanMs: 1000, lockoutMs: 300 });
    ctl.start();
    vi.advanceTimersByTime(2000); // item 2
    ctl.keyDown('s', 'select'); ctl.keyUp('s');
    expect(log.activated).toEqual([[0, 2]]);
    expect(current()).toBeNull();
    // A second press right after (400 ms in the old code activated Home).
    vi.advanceTimersByTime(320);
    ctl.keyDown('s', 'select'); ctl.keyUp('s');
    expect(log.activated.length).toBe(1);
    vi.advanceTimersByTime(SETTLE_MS);
    expect(current()).toEqual({ kind: 'item', gi: 0, ii: 0 });
  });

  it('acceptance time: a brief press is ignored, a long enough one counts', () => {
    const { ctl, log } = harness([1, 3], { acceptMs: 300 });
    ctl.start();
    ctl.keyDown('a', 'select');
    vi.advanceTimersByTime(200);
    ctl.keyUp('a');
    vi.advanceTimersByTime(500);
    expect(log.activated).toEqual([]);
    ctl.keyDown('a', 'select');
    vi.advanceTimersByTime(300);
    expect(log.activated).toEqual([[0, 0]]);
  });

  it('acceptance time also applies to taps', () => {
    const { ctl, log } = harness([1, 3], { acceptMs: 250 });
    ctl.start();
    ctl.pointerDown(); vi.advanceTimersByTime(100); ctl.pointerUp();
    expect(log.activated).toEqual([]);
    ctl.pointerDown(); vi.advanceTimersByTime(300); ctl.pointerUp();
    expect(log.activated).toEqual([[0, 0]]);
  });

  it('two-switch mode: next moves, select chooses; long tap selects', () => {
    const { ctl, log, current } = harness([2, 2], { mode: 'step' });
    ctl.start();
    ctl.keyDown(' ', 'next'); ctl.keyUp(' ');
    expect(current()).toEqual({ kind: 'group', gi: 1 });
    ctl.pointerDown(); vi.advanceTimersByTime(700); ctl.pointerUp(); // long tap: enter row 1
    expect(current()).toEqual({ kind: 'item', gi: 1, ii: 0 });
    ctl.pointerDown(); vi.advanceTimersByTime(50); ctl.pointerUp(); // short tap: next
    ctl.keyDown('Enter', 'select'); ctl.keyUp('Enter');
    expect(log.activated).toEqual([[1, 1]]);
    // No timer in step mode.
    vi.advanceTimersByTime(10_000);
    expect(log.activated.length).toBe(1);
  });

  it('first-item delay keeps the first highlight longer', () => {
    const { ctl, current } = harness([2, 2, 2], { scanMs: 1000, firstMs: 1500 });
    ctl.start();
    vi.advanceTimersByTime(1000);
    expect(current()).toEqual({ kind: 'group', gi: 0 });
    vi.advanceTimersByTime(1500);
    expect(current()).toEqual({ kind: 'group', gi: 1 });
  });

  it('pauses after the set number of loops, and the next press only resumes', () => {
    const { ctl, log, current } = harness([2, 2], { scanMs: 100, loops: 2 });
    ctl.start();
    vi.advanceTimersByTime(100 * 10);
    expect(ctl.paused).toBe(true);
    expect(current()).toBeNull();
    expect(ctl.input('select')).toBe('resumed');
    expect(log.activated).toEqual([]);
    expect(current()).toEqual({ kind: 'group', gi: 0 });
  });

  it('stop() clears the highlight but keeps the lockout', () => {
    const { ctl, log, current } = harness([1], { lockoutMs: 1000 });
    ctl.start();
    ctl.input('select');
    ctl.stop();
    expect(current()).toBeNull();
    ctl.start();
    expect(ctl.input('select')).toBe('ignored');
    vi.advanceTimersByTime(1000);
    expect(ctl.input('select')).toBe('activated');
    expect(log.activated.length).toBe(2);
  });
});

// ---------- Pointer (dwell / head / eyes), rings, gate ----------

describe('dwell arming', () => {
  it('re-arms only after real movement (and the refractory time for head/eyes)', () => {
    const a = new DwellArming(24, 400);
    expect(a.check(100, 100, 0)).toBe(true);
    a.disarm(100, 100, 1000);
    expect(a.check(100, 100, 5000)).toBe(false); // resting pointer, new board: nothing fires
    expect(a.check(110, 100, 5000)).toBe(false); // jitter
    expect(a.check(130, 100, 1200)).toBe(false); // too soon
    expect(a.check(130, 100, 1500)).toBe(true);
    expect(a.armed).toBe(true);
  });
});

describe('pointer start/stop race', () => {
  it('stop() during camera start releases the camera and never starts a loop', async () => {
    let resolveCam: (s: unknown) => void = () => {};
    const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    const raf = vi.fn(() => 1);
    const listeners = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('window', listeners);
    vi.stubGlobal('document', { ...listeners, visibilityState: 'visible', createElement: () => ({ play: () => Promise.resolve() }) });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise((r) => { resolveCam = r; }) } });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    try {
      const e = new PointerEngine({ mode: 'head', dwellMs: 1000, sensitivity: 5, smoothing: 0.5, blinkSelect: false });
      const states: string[] = [];
      e.subscribe((s) => states.push(s.status));
      const started = e.start();
      e.stop(); // e.g. Grown-ups opened while the camera was starting
      resolveCam(stream);
      await started;
      expect(track.stop).toHaveBeenCalled();
      expect(raf).not.toHaveBeenCalled();
      expect(states[states.length - 1]).toBe('idle');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('gaze calibration check', () => {
  const W = 1000, H = 800;
  const points = [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.1, 0.9], [0.5, 0.9], [0.9, 0.9]];
  const good = points.flatMap(([px, py]) => Array.from({ length: 5 }, (_, k) => ({
    f: [1, px + (k - 2) * 0.002, py + (k % 2) * 0.002, 0.5, 0.5], x: px * W, y: py * H,
  })));
  it('accepts a clean fit', () => {
    const cal = fitCalibration(good);
    expect(checkCalibration(good, cal, W, H).ok).toBe(true);
  });
  it('rejects a fit from a lost face (features that do not follow the dots)', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const garbage = good.map((s) => ({ ...s, f: [1, 0.5 + rnd() * 0.01, 0.5 + rnd() * 0.01, 0.5 + rnd() * 0.01, 0.5] }));
    const cal = fitCalibration(garbage);
    expect(checkCalibration(garbage, cal, W, H).ok).toBe(false);
  });
  it('rejects too few dots', () => {
    const few = good.filter((s) => s.y < H / 2);
    expect(checkCalibration(few, fitCalibration(few), W, H).ok).toBe(false);
  });
});

describe('scan / dwell / focus rings (at least 3:1)', () => {
  const css: string = readFileSync(new URL('../../styles/app.css', import.meta.url), 'utf8');
  it('every theme colour contrasts with its background', () => {
    for (const th of Object.values(RING_THEMES)) {
      expect(contrast(th.scan, th.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(th.focus, th.bg)).toBeGreaterThanOrEqual(3);
    }
  });
  it('the black/white inner pair contrasts with every button fill', () => {
    const fills = [...Object.values(WORD_COLORS).flatMap((c) => [c.light, c.dark]), ...COLOR_SWATCHES, ...HIGHLIGHT_COLORS.map((c) => c.value).filter(Boolean)];
    for (const f of fills) expect(Math.max(contrast(f, '#000000'), contrast(f, '#ffffff'))).toBeGreaterThanOrEqual(3);
  });
  it('app.css uses the same per-theme ring colours', () => {
    for (const th of Object.values(RING_THEMES)) {
      expect(css).toContain(`--scan: ${th.scan}`);
      expect(css).toContain(`--focus: ${th.focus}`);
    }
  });
  it('the Find-word highlight has a static ring, not only an animated one', () => {
    const at = css.indexOf('.cell-highlight {');
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toMatch(/outline:/);
    expect(css).toContain('@keyframes glow { 50% { transform: scale(1.04); } }');
  });
});

describe('grown-up gate', () => {
  it('backs off gently after three wrong tries, capped at a minute', () => {
    expect(backoffMs(1)).toBe(0);
    expect(backoffMs(2)).toBe(0);
    expect(backoffMs(3)).toBe(5000);
    expect(backoffMs(4)).toBe(10000);
    expect(backoffMs(20)).toBe(60000);
  });
});

describe('switch key names', () => {
  it('shows readable names', () => {
    expect(keyName(' ')).toBe('Space');
    expect(keyName('a')).toBe('A');
    expect(keyName('KeyB')).toBe('B');
    expect(keyName('Enter')).toBe('Enter');
  });
});
