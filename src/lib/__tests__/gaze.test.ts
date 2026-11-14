import { describe, expect, it, vi } from 'vitest';
import { PointerEngine, checkCalibration, fitCalibration, restDwellMs } from '../pointer';

const W = 1280, H = 800;
const DOTS = [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.1, 0.9], [0.5, 0.9], [0.9, 0.9]];

/** Deterministic pseudo-random normal noise. */
function rng(seed: number) {
  let s = seed;
  const u = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

/**
 * Webcam-like samples: features follow the gaze weakly (the iris moves only a little, vertical
 * gaze barely at all) and wobble a lot from frame to frame.
 */
function webcam({ seed = 3, perDot = 30, noise = 1, signal = 1 } = {}) {
  const n = rng(seed);
  return DOTS.flatMap(([gx, gy]) => Array.from({ length: perDot }, () => ({
    f: [
      1,
      0.5 + signal * 0.12 * (gx - 0.5) + noise * 0.035 * n(), // iris x
      0.45 + signal * 0.05 * (gy - 0.5) + noise * 0.03 * n(), // iris y: weak and noisy
      0.5 + 0.004 * n(), 0.5 + 0.004 * n(), // nose: the head is still
      0.3 - signal * 0.04 * (gy - 0.5) + noise * 0.02 * n(), // openness: lids drop when looking down
      signal * 0.5 * (gx - 0.5) + noise * 0.15 * n(), // eye-look horizontal
      -signal * 0.4 * (gy - 0.5) + noise * 0.15 * n(), // eye-look vertical
    ],
    x: gx * W, y: gy * H,
  })));
}

describe('eye-gaze calibration with webcam-like data', () => {
  it('accepts noisy but real gaze and spreads predictions across the screen', () => {
    const samples = webcam();
    const cal = fitCalibration(samples);
    const check = checkCalibration(samples, cal, W, H);
    expect(check.ok).toBe(true);
    // Corner dots land in the right quarter of the screen on average.
    const avg = (gx: number, gy: number) => {
      const own = samples.filter((s) => s.x === gx * W && s.y === gy * H);
      const px = own.reduce((a, s) => a + cal![0].reduce((t, w, i) => t + w * s.f[i], 0), 0) / own.length;
      const py = own.reduce((a, s) => a + cal![1].reduce((t, w, i) => t + w * s.f[i], 0), 0) / own.length;
      return { px, py };
    };
    const tl = avg(0.1, 0.1), br = avg(0.9, 0.9);
    expect(tl.px).toBeLessThan(W * 0.3); expect(tl.py).toBeLessThan(H * 0.3);
    expect(br.px).toBeGreaterThan(W * 0.7); expect(br.py).toBeGreaterThan(H * 0.7);
  });

  it('works on a phone held upright (narrow screen)', () => {
    const samples = webcam({ seed: 11 }).map((s) => ({ ...s, x: (s.x / W) * 390, y: (s.y / H) * 844 }));
    expect(checkCalibration(samples, fitCalibration(samples), 390, 844).ok).toBe(true);
  });

  it('accepts old-style data with only the five original features', () => {
    const samples = webcam({ seed: 5, noise: 0.5 }).map((s) => ({ ...s, f: s.f.slice(0, 5) }));
    expect(checkCalibration(samples, fitCalibration(samples), W, H).ok).toBe(true);
  });

  it('rejects features that do not follow the dots (face mostly lost)', () => {
    for (const seed of [2, 7, 19, 23]) {
      const samples = webcam({ seed, signal: 0 });
      expect(checkCalibration(samples, fitCalibration(samples), W, H).ok).toBe(false);
    }
  });

  it('rejects too few dots with a face', () => {
    const samples = webcam().filter((s) => s.y < H / 2);
    const res = checkCalibration(samples, fitCalibration(samples), W, H);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('few-points');
  });
});

describe('Rest', () => {
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };

  it('a tap on Rest stops the camera and every selection until Resume is tapped', async () => {
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    const getUserMedia = vi.fn(async () => stream);
    const listeners = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('window', listeners);
    vi.stubGlobal('document', { ...listeners, visibilityState: 'visible', createElement: () => ({ play: () => new Promise(() => {}) }) });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    try {
      const e = new PointerEngine({ mode: 'dwell', dwellMs: 1000, sensitivity: 5, smoothing: 0.5, blinkSelect: false });
      await e.start();
      e.toggleRest(true);
      expect(e.current.resting).toBe(true);
      expect(e.current.pausedByHand).toBe(true);
      e.toggleRest(true);
      expect(e.current.resting).toBe(false);
      expect(e.current.pausedByHand).toBe(false);
      // Hands-free rest keeps watching; resuming needs a long dwell.
      e.toggleRest(false);
      expect(e.current.resting).toBe(true);
      expect(e.current.pausedByHand).toBe(false);
      e.stop();
      expect(e.current.resting).toBe(false);

      // Eye gaze: a tap on Rest switches the camera off; a tap on Resume opens it again.
      const g = new PointerEngine({ mode: 'eyes', dwellMs: 1000, sensitivity: 5, smoothing: 0.5, blinkSelect: false });
      const priv = g as unknown as { running: boolean; stream: unknown; video: unknown };
      priv.running = true; priv.stream = stream; priv.video = {};
      track.stop.mockClear(); getUserMedia.mockClear();
      g.toggleRest(true);
      expect(track.stop).toHaveBeenCalled();
      expect(g.current.status).toBe('idle');
      expect(g.current.visible).toBe(false);
      g.toggleRest(true);
      expect(g.current.resting).toBe(false);
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      g.stop();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resuming hands-free takes a long, deliberate dwell', () => {
    expect(restDwellMs(800)).toBe(2500);
    expect(restDwellMs(2000)).toBe(4000);
  });
});
