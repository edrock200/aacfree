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
    void e.start();
    return () => { unsub(); e.stop(); if (shared === e) shared = null; engineRef.current = null; setSt(null); };
  // Only restart when the mode changes; other options update live below.
  }, [mode]);

  useEffect(() => {
    engineRef.current?.update({ mode, dwellMs: s.dwellMs, sensitivity: s.pointerSensitivity, smoothing: s.pointerSmoothing, blinkSelect: s.blinkSelect, calibration: s.gazeCalibration });
  }, [mode, s.dwellMs, s.pointerSensitivity, s.pointerSmoothing, s.blinkSelect, s.gazeCalibration]);

  if (mode === 'off' || !st) return null;
  const camera = mode === 'head' || mode === 'eyes';
  const showChip = camera || s.dwellRest !== false;
  const message = st.countdown ? t('Look at the middle of the screen… {n}', { n: st.countdown })
    : st.pausedByHand ? t('Paused. Tap Resume to carry on.')
    : st.resting ? t('Resting: look at Resume for a few seconds to carry on')
      : st.message ? t(st.message)
        : camera ? t(mode === 'head' ? 'Head pointer on' : 'Eye gaze on') : '';
  return createPortal(
    <>
      {st.visible && (
        <div className={`pointer-cursor ${st.lost ? 'lost' : ''} ${st.resting ? 'resting' : ''}`} style={{ transform: `translate(${st.x}px, ${st.y}px)` }} aria-hidden>
          {!st.lost && <div className="pointer-ring" style={{ background: `conic-gradient(var(--ring-c) ${st.progress * 360}deg, transparent 0)` }} />}
          <div className="pointer-dot" />
        </div>
      )}
      {showChip && (
        // data-modal-keep: stays usable while a dialog is open (Restart camera, Rest).
        <div className={`pointer-status pointer-exempt scan-exempt ${st.status} ${st.resting ? 'resting' : ''}`} role="status" data-modal-keep>
          {message && <span>{message}</span>}
          {s.dwellRest !== false && (
            // Dwellable even while resting, so the person can pause and resume hands-free.
            <button className={`btn small pointer-rest ${st.resting ? 'primary' : ''}`} data-dwell-ok data-dwell-rest
              // A real tap or click (detail > 0) pauses everything, camera included; a dwell, switch or key rests hands-free.
              onClick={(e) => engineRef.current?.toggleRest(e.detail > 0)} aria-pressed={!!st.resting}>
              {st.resting ? t('Resume') : t('Rest')}
            </button>
          )}
          {mode === 'head' && st.status === 'tracking' && !st.resting && (
            // Dwell on Centre (or tap it), then look at the middle while it counts down.
            <button className="btn small" data-dwell-ok onClick={() => engineRef.current?.recenterSoon()} disabled={!!st.countdown}>{t('Centre')}</button>
          )}
          {camera && (st.canRestart || st.status === 'error') && (
            <button className="btn small primary" data-dwell-ok onClick={() => engineRef.current?.restartCamera()}>{t('Restart camera')}</button>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
