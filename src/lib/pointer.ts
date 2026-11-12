/**
 * Alternative pointer access: dwell selection, camera head-pointer and
 * (experimental) camera eye-gaze. Everything runs on the device; camera frames
 * are never stored or sent anywhere.
 *
 *  - dwell: rest the pointer on a button for `dwellMs` to select it. Works with a
 *    mouse, a head-mouse, or a hardware eye tracker that moves the system cursor.
 *  - head:  the camera tracks the nose; head movement moves an on-screen cursor.
 *  - eyes:  the camera tracks the irises; needs a 9-point calibration.
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
  message?: string;
}

const TARGET_SELECTOR = 'button, [role="button"], [data-scan-item], a[href], input[type="checkbox"], select';

/** Landmark indices (MediaPipe face mesh with iris refinement). */
const L = {
  nose: 1,
  rIrisC: 468, lIrisC: 473,
  rOuter: 33, rInner: 133, rTop: 159, rBottom: 145,
  lInner: 362, lOuter: 263, lTop: 386, lBottom: 374,
};

export interface GazeFeatures { f: number[] }

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private landmarker: any = null;
  private center: { x: number; y: number } | null = null;
  private smooth = { x: innerWidth / 2, y: innerHeight / 2 };
  private blinkSince = 0;
  private lastVideoTime = -1;
  /** Latest raw gaze features (for calibration). */
  lastFeatures: number[] | null = null;

  constructor(opts: PointerOptions) {
    this.opts = opts;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private emit(patch: Partial<PointerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  update(opts: PointerOptions) {
    const modeChanged = opts.mode !== this.opts.mode;
    this.opts = opts;
    if (modeChanged) { this.stop(); this.start(); }
  }

  async start() {
    const { mode } = this.opts;
    if (mode === 'off') return;
    if (mode === 'dwell') {
      window.addEventListener('pointermove', this.onMouse, true);
      this.emit({ status: 'tracking', visible: false });
      this.loop();
      return;
    }
    this.emit({ status: 'loading', visible: true, message: 'Starting camera…' });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      const v = document.createElement('video');
      v.playsInline = true;
      v.muted = true;
      v.srcObject = this.stream;
      await v.play();
      this.video = v;
      const vision = await import('@mediapipe/tasks-vision');
      const base = import.meta.env.BASE_URL;
      const fileset = await vision.FilesetResolver.forVisionTasks(new URL(`${base}vision/wasm`, location.href).href);
      this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL(`${base}vision/face_landmarker.task`, location.href).href, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      }).catch(() => vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL(`${base}vision/face_landmarker.task`, location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      }));
      this.emit({ status: 'tracking', message: undefined });
      this.loop();
    } catch (e) {
      console.warn('pointer camera failed', e);
      this.emit({ status: 'error', visible: false, message: 'Camera not available. Check the camera permission.' });
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMouse, true);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    try { this.landmarker?.close(); } catch { /* ignore */ }
    this.landmarker = null;
    this.center = null;
    this.setTarget(null);
    this.emit({ status: 'idle', visible: false, progress: 0, message: undefined });
  }

  /** Make the current head position the centre of the screen. */
  recenter() {
    this.center = null;
  }

  private onMouse = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // touch selects normally
    this.state.x = e.clientX;
    this.state.y = e.clientY;
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.opts.mode === 'head' || this.opts.mode === 'eyes') this.track();
    this.dwell();
  };

  private track() {
    const v = this.video;
    if (!v || !this.landmarker || v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const res = this.landmarker.detectForVideo(v, performance.now());
    const lm = res?.faceLandmarks?.[0];
    if (!lm) {
      if (this.state.status !== 'no-face') this.emit({ status: 'no-face', message: 'Looking for a face…' });
      return;
    }
    if (this.state.status !== 'tracking') this.emit({ status: 'tracking', message: undefined });

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
        if (!this.blinkSince) this.blinkSince = performance.now();
        else if (performance.now() - this.blinkSince > 500 && this.target) {
          this.fire(this.target);
          this.blinkSince = Number.POSITIVE_INFINITY; // wait for eyes to open
        }
      } else this.blinkSince = 0;
    }
  }

  private dwell() {
    const { x, y } = this.state;
    const el = document.elementFromPoint(x, y);
    const t = el?.closest(TARGET_SELECTOR) ?? null;
    const ok = t && !(t as HTMLButtonElement).disabled && !t.closest('.scan-exempt, .pointer-exempt');
    this.setTarget(ok ? t : null);
    let progress = 0;
    if (this.target && this.target !== this.lastFired) {
      progress = Math.min(1, (performance.now() - this.enteredAt) / this.opts.dwellMs);
      if (progress >= 1) {
        this.fire(this.target);
        progress = 0;
      }
    }
    if (Math.abs(progress - this.state.progress) > 0.01 || this.opts.mode !== 'dwell') {
      this.emit({ progress, visible: this.opts.mode !== 'dwell' || !!this.target });
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
    (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') (el as HTMLInputElement).click();
  }
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
  return wx && wy ? [wx, wy] : null;
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
