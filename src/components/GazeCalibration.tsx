import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PointerEngine, checkCalibration, fitCalibration } from '../lib/pointer';
import { useStore } from '../store';
import { useDialog } from './Modal';
import { t } from '../i18n';

const POINTS = [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.1, 0.9], [0.5, 0.9], [0.9, 0.9]];
const SETTLE_MS = 500;
const SAMPLE_MS = 1500;
/** A dot whose face can't be seen for this long is skipped, so calibration never hangs. */
const GIVE_UP_MS = 8000;

/**
 * 9-point eye-gaze calibration: look at each dot until it fills.
 * Only fresh camera frames with a face count; while the face is lost the dot
 * waits (and starts again) instead of recording stale samples. A fit that is
 * too inaccurate or squashed is rejected.
 */
export function GazeCalibration({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(-1);
  const [msg, setMsg] = useState(() => t('Starting camera…'));
  const [fill, setFill] = useState(0);
  const [lost, setLost] = useState(false);
  const engine = useRef<PointerEngine | null>(null);
  const status = useRef<string>('idle');
  const samples = useRef<{ f: number[]; x: number; y: number }[]>([]);
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onClose);

  useEffect(() => {
    const e = new PointerEngine({ mode: 'eyes', dwellMs: 1e9, sensitivity: 5, smoothing: 0, blinkSelect: false });
    engine.current = e;
    const unsub = e.subscribe((st) => {
      status.current = st.status;
      if (st.status === 'error') setMsg(t(st.message ?? 'Camera not available'));
      if (st.status === 'tracking') setMsg((m) => (m === t('Starting camera…') ? t('Keep your head still. Look at each dot until it fills up.') : m));
    });
    void e.start();
    return () => { unsub(); e.stop(); };
  }, []);

  useEffect(() => {
    if (i < 0 || i >= POINTS.length) return;
    const [px, py] = POINTS[i];
    const x = px * innerWidth;
    const y = py * innerHeight;
    // Let the eyes settle, then sample for ~1.2 s of frames with a face.
    let start = performance.now();
    const shown = start;
    let lastFrame = -1;
    let mine: { f: number[]; x: number; y: number }[] = [];
    const next = () => { if (i + 1 < POINTS.length) setI(i + 1); else finish(); };
    const timer = setInterval(() => {
      const e = engine.current;
      if (!e) return;
      if (status.current !== 'tracking' || !e.lastFeatures) {
        // Face lost: drop this dot's samples and wait for the face to come back (or skip the dot).
        setLost(true);
        start = performance.now();
        mine = [];
        setFill(0);
        if (performance.now() - shown > GIVE_UP_MS) { clearInterval(timer); next(); }
        return;
      }
      setLost(false);
      const el = performance.now() - start;
      if (el > SETTLE_MS && e.featureFrame !== lastFrame) {
        lastFrame = e.featureFrame;
        mine.push({ f: [...e.lastFeatures], x, y });
      }
      setFill(Math.min(1, el / (SETTLE_MS + SAMPLE_MS)));
      if (el > SETTLE_MS + SAMPLE_MS) {
        clearInterval(timer);
        samples.current.push(...mine);
        next();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [i]);

  const finish = () => {
    const cal = fitCalibration(samples.current);
    const check = checkCalibration(samples.current, cal, innerWidth, innerHeight);
    if (!cal || !check.ok) {
      setMsg(check.reason === 'few-points'
        ? t("Calibration didn't work: your face wasn't seen at enough dots. Face the camera with your face well lit, then try again.")
        : t("Calibration didn't work: the dots couldn't be told apart. Keep your head still, move only your eyes, and look right at each dot."));
      setI(-1);
      samples.current = [];
      return;
    }
    useStore.getState().updateSettings({ gazeCalibration: cal, pointer: 'eyes' });
    useStore.getState().showToast(check.quality === 'rough'
      ? t('Eye gaze calibrated. It is approximate, so larger buttons work best.')
      : t('Eye gaze calibrated'));
    onClose();
  };

  return createPortal(
    <div ref={root} className="calib pointer-exempt scan-exempt" role="dialog" aria-modal="true" aria-labelledby="calib-title" tabIndex={-1}>
      {i < 0 ? (
        <div className="calib-intro">
          <h2 id="calib-title">{t('Eye gaze calibration')}</h2>
          <p role="status">{msg}</p>
          <p className="muted">{t('Sit about an arm’s length from the screen with your face well lit. Webcam eye gaze is approximate. Large buttons (Big or Phone core layouts) work best. A dedicated eye tracker that moves the mouse works with “Dwell (mouse/eye tracker)” mode.')}</p>
          <div className="row">
            <button className="btn primary big" onClick={() => { samples.current = []; setFill(0); setI(0); }}>{t('Start')}</button>
            <button className="btn big" onClick={onClose}>{t('Cancel')}</button>
          </div>
        </div>
      ) : i < POINTS.length ? (
        <>
          <h2 id="calib-title" className="visually-hidden">{t('Eye gaze calibration')}</h2>
          {/* The fill is drawn from progress (not a CSS animation), so it still shows with Reduce motion. */}
          <div className={`calib-dot ${lost ? 'lost' : ''}`} key={i} style={{ left: `${POINTS[i][0] * 100}%`, top: `${POINTS[i][1] * 100}%`,
            background: `conic-gradient(var(--accent) ${fill * 360}deg, var(--accent-soft) 0)` }} />
          {lost && <p className="calib-lost" role="status">{t('Looking for your face…')}</p>}
          <button className="btn calib-cancel" onClick={onClose}>{t('Cancel')}</button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
