import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PointerEngine, type PointerState } from '../lib/pointer';
import type { Settings } from '../types';
import { t } from '../i18n';

let shared: PointerEngine | null = null;
/** The running pointer engine (used by "Centre" and calibration). */
export const pointerEngine = () => shared;

/**
 * Draws the head/eye cursor with a dwell ring, and drives selection.
 * Touch keeps working normally, so grown-ups can always tap.
 */
export function PointerLayer({ s, active }: { s: Settings; active: boolean }) {
  const [st, setSt] = useState<PointerState | null>(null);
  const engineRef = useRef<PointerEngine | null>(null);
  const mode = active ? s.pointer : 'off';

  useEffect(() => {
    if (mode === 'off') return;
    const e = new PointerEngine({ mode, dwellMs: s.dwellMs, sensitivity: s.pointerSensitivity, smoothing: s.pointerSmoothing, blinkSelect: s.blinkSelect, calibration: s.gazeCalibration });
    engineRef.current = e;
    shared = e;
    const unsub = e.subscribe(setSt);
    e.start();
    return () => { unsub(); e.stop(); if (shared === e) shared = null; engineRef.current = null; setSt(null); };
  // Only restart when the mode changes; other options update live below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    engineRef.current?.update({ mode, dwellMs: s.dwellMs, sensitivity: s.pointerSensitivity, smoothing: s.pointerSmoothing, blinkSelect: s.blinkSelect, calibration: s.gazeCalibration });
  }, [mode, s.dwellMs, s.pointerSensitivity, s.pointerSmoothing, s.blinkSelect, s.gazeCalibration]);

  if (mode === 'off' || !st) return null;
  return createPortal(
    <>
      {st.visible && (
        <div className="pointer-cursor" style={{ transform: `translate(${st.x}px, ${st.y}px)` }} aria-hidden>
          <div className="pointer-ring" style={{ background: `conic-gradient(var(--accent) ${st.progress * 360}deg, transparent 0)` }} />
          <div className="pointer-dot" />
        </div>
      )}
      {(mode === 'head' || mode === 'eyes') && (
        <div className={`pointer-status pointer-exempt ${st.status}`} role="status">
          {st.message ?? (mode === 'head' ? 'Head pointer on' : 'Eye gaze on')}
          {mode === 'head' && st.status === 'tracking' && (
            <button className="btn small" onClick={() => engineRef.current?.recenter()}>{t('Centre')}</button>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
