/**
 * Alternative pointer access: dwell selection, camera head-pointer and
 * (experimental) camera eye-gaze. Everything runs on the device; camera frames
 * are never stored or sent anywhere.
 *
 *  - dwell: rest the pointer on a button for `dwellMs` to select it. Works with a
 *    mouse, a head-mouse, or a hardware eye tracker that moves the system cursor.
 *  - head:  the camera tracks the nose; head movement moves an on-screen cursor.
 *  - eyes:  the camera tracks the irises; needs a 9-point calibration.
 *
 * Safety rules (v0.4 review, defects 16, 17, 19, 20):
 *  - start/stop can't race: every await checks a generation token, and a stale start releases what it opened;
 *  - the camera is released while the app is hidden, restarted when visible, and restarted (with
 *    backoff) when its track ends or stalls; a "Restart camera" control is always offered on failure;
 *  - dwell never arms before a real pointer has moved, and after a selection or a change of page under
 *    a resting pointer it waits for real movement again;
 *  - with the face lost, nothing dwells and the cursor freezes.
 */

export type PointerMode = 'off' | 'dwell' | 'head' | 'eyes';

export interface PointerOptions {
  mode: PointerMode;
  dwellMs: number;
  sensitivity: number; // 1..10 (head)
  smoothing: number; // 0..0.95
  blinkSelect: boolean;
  calibration?: number[][]; // eyes: [wx[], wy[]]
}

type Listener = (s: PointerState) => void;

export interface PointerState {
  x: number;
  y: number;
  visible: boolean;
  progress: number; // 0..1 dwell progress
  status: 'idle' | 'loading' | 'tracking' | 'no-face' | 'error';
  /** English text (translated by the UI). */
  message?: string;
  /** Face lost: the cursor is frozen and dimmed, nothing is selected. */
  lost?: boolean;
  /** The person dwelled on Rest: only the Rest button responds until they dwell on it again. */
  resting?: boolean;
  /** Offer a "Restart camera" button. */
  canRestart?: boolean;
  /** Seconds left before re-centring (head pointer). */
  countdown?: number;
}

/** Things a dwell can select. `select` is left out: a dwell can't open its list. */
const TARGET_SELECTOR = 'button, [role="button"], [data-scan-item], a[href], input[type="checkbox"]';

/** Movement (px) needed to re-arm after a selection or a page change under a resting pointer. */
export const REARM_PX = { dwell: 8, camera: 24 };
/** Head/eye cursors also wait this long after a selection (jitter alone must not re-arm). */
export const REFRACTORY_MS = 400;
const STALL_MS = 2000;
const MAX_AUTO_RESTARTS = 3;

/** Landmark indices (MediaPipe face mesh with iris refinement). */
const L = {
  nose: 1,
  rIrisC: 468, lIrisC: 473,
  rOuter: 33, rInner: 133, rTop: 159, rBottom: 145,
  lInner: 362, lOuter: 263, lTop: 386, lBottom: 374,
};

export interface GazeFeatures { f: number[] }

/**
 * Dwell arming rules, kept pure for tests. A target arms only once a real
 * pointer is present and, after a disarm (a selection, or the page changing
 * under a still pointer), once the pointer has moved far enough.
 */
export class DwellArming {
  private anchor: { x: number; y: number } | null = null;
  private notBefore = 0;
  constructor(private movePx: number, private refractoryMs = 0) {}
  disarm(x: number, y: number, now: number) {
    this.anchor = { x, y };
    this.notBefore = now + this.refractoryMs;
  }
  /** True when armed; clears the anchor once movement and time allow. */
  check(x: number, y: number, now: number) {
    if (!this.anchor) return true;
    if (now >= this.notBefore && Math.hypot(x - this.anchor.x, y - this.anchor.y) >= this.movePx) {
      this.anchor = null;
      return true;
    }
    return false;
  }
  get armed() { return !this.anchor; }
}

export class PointerEngine {
  private opts: PointerOptions;
  private listeners = new Set<Listener>();
  private state: PointerState = { x: innerWidth / 2, y: innerHeight / 2, visible: false, progress: 0, status: 'idle' };
  private target: Element | null = null;
  private enteredAt = 0;
  private lastFired: Element | null = null;
  private raf = 0;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: any = null;
  private center: { x: number; y: number } | null = null;
  private smooth = { x: innerWidth / 2, y: innerHeight / 2 };
  private blinkSince = 0;
  private lastVideoTime = -1;
  /** Bumped by every start()/stop(): a stale async start sees it changed and cleans up after itself. */
  private gen = 0;
  private running = false;
  /** Dwell mode: a real (non-touch) pointer has moved since start / leave / blur. */
  private hasPointer = false;
  private prev = { x: -1, y: -1 };
  private arming: DwellArming;
  private lastFrameAt = 0;
  private restarts = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private hiddenStop = false;
  private recenterTimer?: ReturnType<typeof setInterval>;
  /** Latest raw gaze features (for calibration); null while no face is seen. */
  lastFeatures: number[] | null = null;
  /** Increments with every new camera frame that produced features. */
  featureFrame = 0;

  constructor(opts: PointerOptions) {
    this.opts = opts;
    this.arming = this.makeArming();
  }

  private makeArming() {
    return this.opts.mode === 'dwell' ? new DwellArming(REARM_PX.dwell) : new DwellArming(REARM_PX.camera, REFRACTORY_MS);
  }

  get current() { return this.state; }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private emit(patch: Partial<PointerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  /** Live option changes (dwell time, smoothing…). A mode change makes a new engine (see PointerLayer). */
  update(opts: PointerOptions) {
    const modeChanged = opts.mode !== this.opts.mode;
    this.opts = opts;
    if (modeChanged) { this.stop(); this.arming = this.makeArming(); void this.start(); }
  }

  async start() {
    const g = ++this.gen;
    this.running = true;
    const { mode } = this.opts;
    if (mode === 'off') return;
    document.addEventListener('visibilitychange', this.onVisibility);
    if (mode === 'dwell') {
      this.hasPointer = false;
      window.addEventListener('pointermove', this.onMouse, true);
      window.addEventListener('mouseout', this.onLeave);
      window.addEventListener('blur', this.onLeave);
      this.emit({ status: 'tracking', visible: false, message: undefined });
      this.loop();
      return;
    }
    await this.openCamera(g);
  }

  /** Open the camera (and the face model, once). Safe against stop() running in between. */
  private async openCamera(g: number) {
    this.emit({ status: 'loading', visible: true, canRestart: false, message: this.restarts ? 'Restarting camera…' : 'Starting camera…' });
    let stream: MediaStream | null = null;
    const stale = () => g !== this.gen || !this.running;
    const release = () => stream?.getTracks().forEach((t) => t.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      if (stale()) return release();
      const v = document.createElement('video');
      v.playsInline = true;
      v.muted = true;
      v.srcObject = stream;
      await v.play();
      if (stale()) return release();
      if (!this.landmarker) {
        const lm = await createLandmarker();
        if (stale()) { try { lm.close(); } catch { /* ignore */ } return release(); }
        this.landmarker = lm;
      }
      this.stream = stream;
      this.video = v;
      stream.getVideoTracks().forEach((t) => t.addEventListener('ended', this.onTrackEnded));
      this.lastFrameAt = performance.now();
      this.lastVideoTime = -1;
      this.emit({ status: 'tracking', message: undefined, canRestart: false });
      this.loop();
    } catch (e) {
      release();
      if (stale()) return;
      console.warn('pointer camera failed', e);
      this.emit({ status: 'error', visible: false, canRestart: true, message: 'Camera not available. Check the camera permission.' });
    }
  }

  /** Release the camera only (keeps the face model, centre and calibration). */
  private releaseCamera() {
    this.stream?.getTracks().forEach((t) => { t.removeEventListener('ended', this.onTrackEnded); t.stop(); });
    this.stream = null;
    this.video = null;
    this.lastFeatures = null;
  }

  stop() {
    this.gen++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.recenterTimer) clearInterval(this.recenterTimer);
    window.removeEventListener('pointermove', this.onMouse, true);
    window.removeEventListener('mouseout', this.onLeave);
    window.removeEventListener('blur', this.onLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.releaseCamera();
    try { this.landmarker?.close(); } catch { /* ignore */ }
    this.landmarker = null;
    this.center = null;
    this.setTarget(null);
    this.emit({ status: 'idle', visible: false, progress: 0, message: undefined, lost: false, resting: false, canRestart: false, countdown: undefined });
  }

  /** Manual "Restart camera". */
  restartCamera() {
    if (!this.running || this.opts.mode === 'dwell' || this.opts.mode === 'off') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.releaseCamera();
    this.restarts = 0;
    void this.openCamera(this.gen);
  }

  /** The camera stopped or froze: restart a few times with backoff, then ask for a manual restart. */
  private recoverCamera(reason: string) {
    console.warn('pointer camera lost:', reason);
    this.releaseCamera();
    this.setTarget(null);
    if (this.restarts >= MAX_AUTO_RESTARTS) {
      this.emit({ status: 'error', visible: false, canRestart: true, progress: 0, message: 'The camera stopped.' });
      return;
    }
    const delay = 1000 * 2 ** this.restarts;
    this.restarts++;
    const g = this.gen;
    this.emit({ status: 'loading', progress: 0, canRestart: true, message: 'Restarting camera…' });
    this.retryTimer = setTimeout(() => { if (g === this.gen && this.running) void this.openCamera(g); }, delay);
  }

  private onTrackEnded = () => this.recoverCamera('track ended');

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.hasPointer = false;
      this.setTarget(null);
      if (this.opts.mode === 'head' || this.opts.mode === 'eyes') {
        // Don't keep the camera on while Caleb is in the background.
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.releaseCamera();
        this.hiddenStop = true;
        this.emit({ status: 'loading', progress: 0, message: 'Paused' });
      }
    } else if (this.hiddenStop && this.running) {
      this.hiddenStop = false;
      this.restarts = 0;
      void this.openCamera(this.gen);
    }
  };

  /** Make the current head position the centre of the screen. */
  recenter() {
    this.center = null;
  }

  /** Hands-free re-centre: count down so the person can look at the middle first. */
  recenterSoon(seconds = 3) {
    if (this.recenterTimer) clearInterval(this.recenterTimer);
    let left = seconds;
    this.emit({ countdown: left });
    this.recenterTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(this.recenterTimer);
        this.recenterTimer = undefined;
        this.recenter();
        this.arming.disarm(this.state.x, this.state.y, performance.now());
        this.emit({ countdown: undefined });
      } else this.emit({ countdown: left });
    }, 1000);
  }

  /** Rest: pause dwell selection (only the Rest button stays live). */
  toggleRest() {
    const resting = !this.state.resting;
    this.setTarget(null);
    this.arming.disarm(this.state.x, this.state.y, performance.now());
    this.emit({ resting, progress: 0 });
  }

  private onMouse = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // touch selects normally
    this.hasPointer = true;
    this.state.x = e.clientX;
    this.state.y = e.clientY;
  };

  private onLeave = (e: Event) => {
    // mouseout fires between elements too; only leaving the window (no related target) counts.
    if (e.type === 'mouseout' && (e as MouseEvent).relatedTarget) return;
    this.hasPointer = false;
  };

  private loop = () => {
    if (!this.running) return;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    if (this.opts.mode === 'head' || this.opts.mode === 'eyes') this.track();
    this.dwell();
  };

  private track() {
    const v = this.video;
    if (!v || !this.landmarker) return;
    const now = performance.now();
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) {
      // No new frame for a while: the camera has stalled.
      if (now - this.lastFrameAt > STALL_MS && this.state.status !== 'loading') this.recoverCamera('stalled');
      return;
    }
    this.lastVideoTime = v.currentTime;
    this.lastFrameAt = now;
    const res = this.landmarker.detectForVideo(v, now);
    const lm = res?.faceLandmarks?.[0];
    if (!lm) {
      this.lastFeatures = null;
      this.blinkSince = 0;
      if (this.state.status !== 'no-face') this.emit({ status: 'no-face', lost: true, progress: 0, message: 'Looking for a face…' });
      return;
    }
    this.restarts = 0;
    if (this.state.status !== 'tracking') {
      this.emit({ status: 'tracking', lost: false, canRestart: false, message: undefined });
      // The face is back: don't select whatever the frozen cursor was resting on.
      this.arming.disarm(this.state.x, this.state.y, now);
    }

    let tx: number;
    let ty: number;
    if (this.opts.mode === 'head') {
      const n = lm[L.nose];
      if (!this.center) this.center = { x: n.x, y: n.y };
      const gain = 2 + this.opts.sensitivity * 1.2;
      // The camera image is mirrored: moving the head right lowers x.
      tx = innerWidth / 2 - (n.x - this.center.x) * gain * innerWidth;
      ty = innerHeight / 2 + (n.y - this.center.y) * gain * innerHeight * 1.3;
    } else {
      const f = gazeFeatures(lm);
      this.lastFeatures = f;
      this.featureFrame++;
      const c = this.opts.calibration;
      if (!c) {
        // Uncalibrated: rough guess from iris position only.
        tx = innerWidth * (0.5 - (f[1] - 0.5) * 4);
        ty = innerHeight * (0.5 + (f[2] - 0.5) * 6);
      } else {
        tx = dot(c[0], f);
        ty = dot(c[1], f);
      }
    }
    // Exponential smoothing + small dead zone to stop jitter.
    const a = 1 - Math.min(0.95, Math.max(0, this.opts.smoothing));
    const nx = this.smooth.x + (tx - this.smooth.x) * a;
    const ny = this.smooth.y + (ty - this.smooth.y) * a;
    if (Math.hypot(nx - this.smooth.x, ny - this.smooth.y) > 1.5) this.smooth = { x: nx, y: ny };
    this.state.x = Math.min(innerWidth - 2, Math.max(2, this.smooth.x));
    this.state.y = Math.min(innerHeight - 2, Math.max(2, this.smooth.y));

    // Optional: a long, deliberate blink (both eyes ≥ 0.5 s) selects.
    if (this.opts.blinkSelect) {
      const bs = res.faceBlendshapes?.[0]?.categories ?? [];
      const score = (name: string) => bs.find((c: { categoryName: string; score: number }) => c.categoryName === name)?.score ?? 0;
      const closed = score('eyeBlinkLeft') > 0.55 && score('eyeBlinkRight') > 0.55;
      if (closed) {
        if (!this.blinkSince) this.blinkSince = now;
        else if (now - this.blinkSince > 500 && this.target) {
          this.fire(this.target);
          this.blinkSince = Number.POSITIVE_INFINITY; // wait for eyes to open
        }
      } else this.blinkSince = 0;
    }
  }

  private dwell() {
    const now = performance.now();
    const camera = this.opts.mode !== 'dwell';
    // Face lost (or camera not running): nothing dwells, the cursor stays frozen where it was.
    if (camera && this.state.status !== 'tracking') {
      this.setTarget(null);
      if (this.state.progress) this.emit({ progress: 0 });
      return;
    }
    // Dwell mode: no selection until a real mouse / head-mouse / eye tracker has moved.
    if (!camera && !this.hasPointer) {
      this.setTarget(null);
      if (this.state.visible || this.state.progress) this.emit({ visible: false, progress: 0 });
      return;
    }
    const { x, y } = this.state;
    const still = Math.hypot(x - this.prev.x, y - this.prev.y) < 0.5;
    this.prev = { x, y };
    const el = document.elementFromPoint(x, y);
    const t = el?.closest(TARGET_SELECTOR) ?? null;
    const resting = !!this.state.resting;
    const ok = !!t && !(t as HTMLButtonElement).disabled && !t.closest('[inert]')
      && (t.hasAttribute('data-dwell-ok') || !t.closest('.scan-exempt, .pointer-exempt'))
      && (!resting || t.hasAttribute('data-dwell-rest'));
    const next = ok ? t : null;
    if (next !== this.target) {
      // The target changed although the pointer did not move, so the page changed under it
      // (a folder opened, a dialog closed): wait for real movement before dwelling.
      if (next && still) this.arming.disarm(x, y, now);
      this.setTarget(next);
    }
    let progress = 0;
    const armedNow = this.arming.armed;
    if (this.target && this.target !== this.lastFired && this.arming.check(x, y, now)) {
      if (!armedNow) this.enteredAt = now; // the dwell starts once armed
      progress = Math.min(1, (now - this.enteredAt) / Math.max(200, this.opts.dwellMs));
      if (progress >= 1) {
        this.fire(this.target);
        progress = 0;
      }
    }
    if (Math.abs(progress - this.state.progress) > 0.01 || camera || !!this.target !== this.state.visible) {
      this.emit({ progress, visible: camera || !!this.target });
    }
  }

  private setTarget(t: Element | null) {
    if (t === this.target) return;
    this.target?.classList.remove('pointer-target');
    this.target = t;
    this.enteredAt = performance.now();
    if (t !== this.lastFired) this.lastFired = null; // moving away re-arms
    t?.classList.add('pointer-target');
  }

  private fire(el: Element) {
    this.lastFired = el; // must leave and come back to select it again
    this.arming.disarm(this.state.x, this.state.y, performance.now());
    // One synthetic click (detail 0 = switch/dwell activation). It also toggles a checkbox, so no second click().
    (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
  }
}

async function createLandmarker() {
  const vision = await import('@mediapipe/tasks-vision');
  const base = import.meta.env.BASE_URL;
  const fileset = await vision.FilesetResolver.forVisionTasks(new URL(`${base}vision/wasm`, location.href).href);
  const make = (delegate: 'GPU' | 'CPU') => vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL(`${base}vision/face_landmarker.task`, location.href).href, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  return make('GPU').catch(() => make('CPU'));
}

/** Gaze features: [1, irisX, irisY, noseX, noseY] — iris relative to its eye box. */
export function gazeFeatures(lm: { x: number; y: number }[]): number[] {
  const rel = (iris: number, a: number, b: number, top: number, bottom: number) => {
    const minX = Math.min(lm[a].x, lm[b].x);
    const w = Math.abs(lm[a].x - lm[b].x) || 1e-6;
    const h = Math.abs(lm[bottom].y - lm[top].y) || 1e-6;
    return [(lm[iris].x - minX) / w, (lm[iris].y - lm[top].y) / h];
  };
  const r = rel(L.rIrisC, L.rOuter, L.rInner, L.rTop, L.rBottom);
  const l = rel(L.lIrisC, L.lInner, L.lOuter, L.lTop, L.lBottom);
  return [1, (r[0] + l[0]) / 2, (r[1] + l[1]) / 2, lm[L.nose].x, lm[L.nose].y];
}

const dot = (w: number[], f: number[]) => w.reduce((s, wi, i) => s + wi * (f[i] ?? 0), 0);

/** Least-squares fit (ridge-regularised) of features → screen coordinate. */
export function fitCalibration(samples: { f: number[]; x: number; y: number }[]): number[][] | null {
  if (samples.length < 6) return null;
  const n = samples[0].f.length;
  const solve = (key: 'x' | 'y') => {
    // Normal equations: (XᵀX + λI) w = Xᵀy
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array(n).fill(0);
    for (const s of samples) {
      for (let i = 0; i < n; i++) {
        b[i] += s.f[i] * s[key];
        for (let j = 0; j < n; j++) A[i][j] += s.f[i] * s.f[j];
      }
    }
    for (let i = 1; i < n; i++) A[i][i] += 1e-4;
    return gauss(A, b);
  };
  const wx = solve('x');
  const wy = solve('y');
  return wx && wy && [...wx, ...wy].every(Number.isFinite) ? [wx, wy] : null;
}

/**
 * Is a calibration good enough to use? Rejects fits from too few dots, fits
 * whose error is a large part of the screen, and fits that squash every dot
 * into one area (a "garbage" fit from a face that was mostly lost).
 */
export function checkCalibration(
  samples: { f: number[]; x: number; y: number }[],
  cal: number[][] | null,
  w: number,
  h: number,
): { ok: boolean; error: number; reason?: 'few-points' | 'inaccurate' | 'collapsed' } {
  if (!cal) return { ok: false, error: Infinity, reason: 'few-points' };
  const points = new Map<string, { f: number[]; x: number; y: number }[]>();
  for (const s of samples) {
    const k = `${Math.round(s.x)},${Math.round(s.y)}`;
    points.set(k, [...(points.get(k) ?? []), s]);
  }
  const used = [...points.values()].filter((p) => p.length >= 3);
  if (used.length < 6) return { ok: false, error: Infinity, reason: 'few-points' };
  let se = 0;
  for (const s of samples) {
    const dx = dot(cal[0], s.f) - s.x;
    const dy = dot(cal[1], s.f) - s.y;
    se += dx * dx + dy * dy;
  }
  const error = Math.sqrt(se / samples.length);
  if (!Number.isFinite(error) || error > 0.25 * Math.min(w, h)) return { ok: false, error, reason: 'inaccurate' };
  // Each dot's average prediction must spread across the screen like the dots do.
  const means = used.map((p) => {
    const mx = p.reduce((a, s) => a + dot(cal[0], s.f), 0) / p.length;
    const my = p.reduce((a, s) => a + dot(cal[1], s.f), 0) / p.length;
    return { mx, my };
  });
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
  if (spread(means.map((m) => m.mx)) < 0.35 * w || spread(means.map((m) => m.my)) < 0.35 * h) return { ok: false, error, reason: 'collapsed' };
  return { ok: true, error };
}

function gauss(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let k2 = c; k2 <= n; k2++) M[r][k2] -= k * M[c][k2];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}
