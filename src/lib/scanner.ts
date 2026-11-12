/**
 * Switch-scanning state machine, kept free of the DOM so it can be unit-tested.
 * `useScanner` turns the page into a "shape" (how many items each scan group
 * has), shows the highlight this module asks for, and clicks what it activates.
 *
 * Safety rules (v0.4 review, defect 3):
 *  - a held switch is one press: key-repeat events and a key that is still down never count again;
 *  - an optional acceptance time: the switch must stay down this long to count;
 *  - after an activation, presses are ignored for a lockout period, and that lockout survives the
 *    page changing underneath (a new board, a dialog opening);
 *  - a press while nothing is highlighted never activates anything.
 */

export type ScanAction = 'select' | 'next';

export interface ScanConfig {
  mode: 'auto' | 'step';
  /** Time each item stays highlighted in auto mode. */
  scanMs: number;
  /** The switch must stay down this long before the press counts (0 = immediately). */
  acceptMs: number;
  /** After an activation, ignore the switch for this long. */
  lockoutMs: number;
  /** Extra time on the first item after scanning (re)starts. */
  firstMs: number;
  /** Auto mode: pause after this many passes with no press (0 = never pause). */
  loops: number;
  /** Passes through one row before going back to row scanning. */
  rowPasses: number;
  /** Add a "leave row" step at the end of each row (row/column scanning). */
  leaveRow: boolean;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  mode: 'auto', scanMs: 1500, acceptMs: 0, lockoutMs: 500, firstMs: 0, loops: 0, rowPasses: 2, leaveRow: false,
};

/** Hold a touch this long (2-switch mode on a touchscreen) to select instead of moving on. */
export const LONG_TAP_MS = 600;
/** Time to let the page settle after an activation before scanning restarts. */
export const SETTLE_MS = 350;

export interface Cursor {
  level: 'group' | 'item';
  /** -1 = nothing highlighted yet. */
  gi: number;
  /** Item index inside the group; `== group size` is the "leave row" step. */
  ii: number;
  /** Passes through the current row. */
  rowPass: number;
  /** Completed passes over the top level since the last press. */
  loop: number;
}

export type Highlight =
  | { kind: 'group'; gi: number }
  | { kind: 'item'; gi: number; ii: number }
  | { kind: 'leave'; gi: number };

export const startCursor = (): Cursor => ({ level: 'group', gi: -1, ii: -1, rowPass: 0, loop: 0 });

const isLinear = (shape: number[]) => shape.length === 1;

/** What the cursor points at, or null when nothing is highlighted (or the page changed under it). */
export function highlightOf(c: Cursor, shape: number[]): Highlight | null {
  if (!shape.length || c.gi < 0) return null;
  if (isLinear(shape) || c.level === 'item') {
    const gi = isLinear(shape) ? 0 : c.gi;
    if (gi >= shape.length || c.ii < 0) return null;
    if (c.ii === shape[gi] && !isLinear(shape)) return { kind: 'leave', gi };
    if (c.ii >= shape[gi]) return null;
    return { kind: 'item', gi, ii: c.ii };
  }
  if (c.gi >= shape.length) return null;
  return { kind: 'group', gi: c.gi };
}

/** Move the highlight one step on. */
export function advance(c: Cursor, shape: number[], cfg: Pick<ScanConfig, 'rowPasses' | 'leaveRow'>): Cursor {
  const n = { ...c };
  if (!shape.length) return n;
  if (isLinear(shape)) {
    n.level = 'item';
    n.gi = 0;
    if (n.ii + 1 >= shape[0]) {
      n.ii = 0;
      if (c.ii >= 0) n.loop += 1;
    } else n.ii += 1;
    return n;
  }
  if (n.level === 'group' || n.gi < 0 || n.gi >= shape.length) {
    n.level = 'group';
    if (n.gi + 1 >= shape.length) {
      if (n.gi >= 0) n.loop += 1;
      n.gi = 0;
    } else n.gi += 1;
    n.ii = -1;
    return n;
  }
  // Item level inside a row.
  const size = shape[n.gi] + (cfg.leaveRow ? 1 : 0);
  n.ii += 1;
  if (n.ii >= size) {
    n.ii = 0;
    n.rowPass += 1;
    // After a few passes through a row with no choice, go back up to row scanning.
    if (n.rowPass >= Math.max(1, cfg.rowPasses)) {
      n.level = 'group';
      n.rowPass = 0;
      n.ii = -1;
    }
  }
  return n;
}

/**
 * The switch chose the highlighted thing. Returns the new cursor and, when an
 * item should be activated, which one. Nothing highlighted → nothing happens.
 */
export function choose(c: Cursor, shape: number[]): { cursor: Cursor; activate?: { gi: number; ii: number } } {
  const h = highlightOf(c, shape);
  if (!h) return { cursor: c };
  if (h.kind === 'group') {
    if (shape[h.gi] === 1) return { cursor: c, activate: { gi: h.gi, ii: 0 } };
    return { cursor: { ...c, level: 'item', ii: 0, rowPass: 0, loop: 0 } };
  }
  if (h.kind === 'leave') return { cursor: { ...c, level: 'group', ii: -1, rowPass: 0, loop: 0 } };
  return { cursor: c, activate: { gi: h.gi, ii: h.ii } };
}

/** Which switch action a key means. Custom keys (set by a grown-up) win over the defaults. */
export function keyAction(
  key: { key: string; code?: string },
  mode: ScanConfig['mode'],
  custom: { select?: string; next?: string } = {},
): ScanAction | null {
  const is = (k?: string) => !!k && (key.key === k || key.code === k);
  if (is(custom.select)) return 'select';
  if (is(custom.next)) return 'next';
  const k = key.key;
  if (mode === 'auto') return k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab' ? 'select' : null;
  if (k === 'Enter') return 'select';
  if (k === ' ' || k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab') return 'next';
  return null;
}

/** A readable name for a stored key ("Space", "Enter", "F1", "a"). */
export function keyName(k: string) {
  if (k === ' ' || k === 'Space') return 'Space';
  if (k.length === 1) return k.toUpperCase();
  return k.replace(/^Key/, '').replace(/^Digit/, '');
}

export interface ScanHost {
  /** Item count per scan group, as the page looks right now. */
  shape(): number[];
  /** Draw (or clear) the highlight. `cue` = speak it (auditory scanning). */
  show(h: Highlight | null): void;
  /** Click the item. */
  activate(gi: number, ii: number): void;
  now(): number;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Timing and input layer: acceptance time, key repeat, lockout, auto-advance,
 * first-item delay and loops before pausing. One controller lives for the whole
 * app session, so the lockout survives the page changing.
 */
export class ScanController {
  cfg: ScanConfig;
  cursor: Cursor = startCursor();
  /** Auto mode stopped after `loops` passes; the next press only resumes. */
  paused = false;
  running = false;
  private host: ScanHost;
  private timer?: Timer;
  private settle?: Timer;
  private lockUntil = 0;
  private held = new Map<string, { at: number; timer?: Timer; action: ScanAction }>();
  private touchAt = -1;

  constructor(host: ScanHost, cfg: Partial<ScanConfig> = {}) {
    this.host = host;
    this.cfg = { ...DEFAULT_SCAN_CONFIG, ...cfg };
  }

  configure(cfg: Partial<ScanConfig>) {
    const modeChanged = cfg.mode !== undefined && cfg.mode !== this.cfg.mode;
    this.cfg = { ...this.cfg, ...cfg };
    if (this.running && modeChanged) this.restart();
  }

  /** Begin scanning at the first item. */
  start() {
    this.running = true;
    this.restart();
  }

  /** Stop scanning (the lockout and held keys are kept). */
  stop() {
    this.running = false;
    this.clearTimers();
    this.cursor = startCursor();
    this.host.show(null);
  }

  /** The page changed (new board, dialog opened): start again from the first item. */
  refresh() {
    if (this.running) this.restart();
  }

  get lockedOut() {
    return this.host.now() < this.lockUntil;
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.settle) clearTimeout(this.settle);
    this.timer = undefined;
    this.settle = undefined;
  }

  private restart() {
    this.clearTimers();
    this.paused = false;
    this.cursor = advance(startCursor(), this.host.shape(), this.cfg);
    this.render();
    this.schedule(true);
  }

  private render() {
    this.host.show(highlightOf(this.cursor, this.host.shape()));
  }

  private schedule(first = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.running || this.cfg.mode !== 'auto' || this.paused) return;
    this.timer = setTimeout(() => this.tick(), this.cfg.scanMs + (first ? this.cfg.firstMs : 0));
  }

  /** Auto-advance (also the "next" switch). */
  private tick() {
    const shape = this.host.shape();
    const next = advance(this.cursor, shape, this.cfg);
    if (this.cfg.mode === 'auto' && this.cfg.loops > 0 && next.loop >= this.cfg.loops) {
      // Nobody is pressing: rest instead of scanning forever.
      this.paused = true;
      this.cursor = startCursor();
      this.host.show(null);
      return;
    }
    this.cursor = next;
    this.render();
    this.schedule();
  }

  /** An accepted switch press. Returns what it did (for tests and logging). */
  input(action: ScanAction): 'ignored' | 'resumed' | 'moved' | 'entered' | 'activated' {
    if (!this.running) return 'ignored';
    if (this.lockedOut || this.settle) return 'ignored';
    if (this.paused) {
      this.restart();
      return 'resumed';
    }
    const shape = this.host.shape();
    if (action === 'next') {
      this.cursor = { ...advance(this.cursor, shape, this.cfg), loop: 0 };
      this.render();
      this.schedule();
      return 'moved';
    }
    const { cursor, activate } = choose(this.cursor, shape);
    if (!activate) {
      if (cursor === this.cursor) return 'ignored';
      this.cursor = cursor;
      this.render();
      this.schedule(true);
      return 'entered';
    }
    // Activation: stop the auto timer, lock the switch out, let the page settle, start again.
    this.clearTimers();
    this.cursor = startCursor();
    this.host.show(null);
    this.lockUntil = this.host.now() + Math.max(0, this.cfg.lockoutMs);
    this.host.activate(activate.gi, activate.ii);
    this.settle = setTimeout(() => {
      this.settle = undefined;
      if (this.running && this.cursor.gi < 0) this.restart();
    }, SETTLE_MS);
    return 'activated';
  }

  /** A switch key went down. Repeats and keys already down are ignored. */
  keyDown(id: string, action: ScanAction, repeat = false) {
    if (repeat) return;
    const prev = this.held.get(id);
    if (prev?.timer) clearTimeout(prev.timer);
    const entry: { at: number; timer?: Timer; action: ScanAction } = { at: this.host.now(), action };
    this.held.set(id, entry);
    if (this.cfg.acceptMs <= 0) this.input(action);
    else entry.timer = setTimeout(() => { entry.timer = undefined; if (this.held.get(id) === entry) this.input(action); }, this.cfg.acceptMs);
  }

  keyUp(id: string) {
    const e = this.held.get(id);
    if (e?.timer) clearTimeout(e.timer);
    this.held.delete(id);
  }

  /** Forget held keys (window lost focus: their keyup may never arrive). */
  releaseAll() {
    this.held.forEach((e) => e.timer && clearTimeout(e.timer));
    this.held.clear();
    this.touchAt = -1;
  }

  /** The screen used as a switch: decided on release (short/long tap). */
  pointerDown() {
    this.touchAt = this.host.now();
  }

  pointerUp() {
    if (this.touchAt < 0) return;
    const held = this.host.now() - this.touchAt;
    this.touchAt = -1;
    if (held < this.cfg.acceptMs) return;
    this.input(this.cfg.mode === 'auto' || held >= LONG_TAP_MS ? 'select' : 'next');
  }

  pointerCancel() {
    this.touchAt = -1;
  }
}
