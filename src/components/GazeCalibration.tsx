import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PointerEngine, fitCalibration } from '../lib/pointer';
import { useStore } from '../store';
import { t } from '../i18n';

const POINTS = [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.1, 0.9], [0.5, 0.9], [0.9, 0.9]];

/** 9-point eye-gaze calibration: look at each dot until it fills. */
export function GazeCalibration({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(-1);
  const [msg, setMsg] = useState('Starting camera…');
  const engine = useRef<PointerEngine | null>(null);
  const samples = useRef<{ f: number[]; x: number; y: number }[]>([]);

  useEffect(() => {
    const e = new PointerEngine({ mode: 'eyes', dwellMs: 1e9, sensitivity: 5, smoothing: 0, blinkSelect: false });
    engine.current = e;
    const unsub = e.subscribe((st) => {
      if (st.status === 'error') setMsg(st.message ?? 'Camera not available');
      if (st.status === 'tracking' && i < 0) setMsg(t('Keep your head still. Look at each dot until it fills up.'));
    });
    e.start();
    return () => { unsub(); e.stop(); };
  }, []);

  useEffect(() => {
    if (i < 0 || i >= POINTS.length) return;
    const [px, py] = POINTS[i];
    const x = px * innerWidth;
    const y = py * innerHeight;
    // Let the eyes settle, then sample for ~1.2 s.
    const start = performance.now();
    const timer = setInterval(() => {
      const t = performance.now() - start;
      const f = engine.current?.lastFeatures;
      if (t > 500 && f) samples.current.push({ f: [...f], x, y });
      if (t > 1700) {
        clearInterval(timer);
        if (i + 1 < POINTS.length) setI(i + 1);
        else finish();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [i]);

  const finish = () => {
    const cal = fitCalibration(samples.current);
    if (!cal) {
      setMsg(t('Calibration failed — make sure your face is well lit and visible, then try again.'));
      setI(-1);
      samples.current = [];
      return;
    }
    useStore.getState().updateSettings({ gazeCalibration: cal, pointer: 'eyes' });
    useStore.getState().showToast(t('Eye gaze calibrated'));
    onClose();
  };

  return createPortal(
    <div className="calib pointer-exempt scan-exempt">
      {i < 0 ? (
        <div className="calib-intro">
          <h2>{t('Eye gaze calibration')}</h2>
          <p>{msg}</p>
          <p className="muted">Sit about an arm's length from the screen with your face well lit. Webcam eye gaze is approximate. Large buttons (Big or Phone core layouts) work best. A dedicated eye tracker that moves the mouse works with “Dwell (mouse/eye tracker)” mode.</p>
          <div className="row">
            <button className="btn primary big" onClick={() => { samples.current = []; setI(0); }}>{t('Start')}</button>
            <button className="btn big" onClick={onClose}>{t('Cancel')}</button>
          </div>
        </div>
      ) : i < POINTS.length ? (
        <div className="calib-dot" key={i} style={{ left: `${POINTS[i][0] * 100}%`, top: `${POINTS[i][1] * 100}%` }} />
      ) : null}
    </div>,
    document.body,
  );
}
