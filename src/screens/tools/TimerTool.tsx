import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { alarm } from '../../lib/feedback';
import { IconPlay, IconStop } from '../../components/Icons';

const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30];

/** Visual countdown timer — the red disc shrinks as time passes. */
export function TimerTool() {
  const { speakText } = useStore.getState();
  const [total, setTotal] = useState(5 * 60);
  const [left, setLeft] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        setRunning(false);
        alarm();
        setTimeout(() => speakText('Time is up! All done.'), 1800);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const frac = total ? left / total : 0;
  const angle = frac * 360;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="timer">
      <div className="timer-face" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}
        style={{ background: `conic-gradient(var(--timer) ${angle}deg, var(--timer-bg) ${angle}deg)` }}>
        <div className="timer-center">{mm}:{ss}</div>
      </div>
      <div className="row-center" data-scan-group>
        {!running ? (
          <button className="btn primary big" disabled={left === 0} onClick={() => setRunning(true)} data-scan-item><IconPlay /> Start</button>
        ) : (
          <button className="btn big" onClick={() => setRunning(false)} data-scan-item><IconStop /> Pause</button>
        )}
        <button className="btn big" onClick={() => { setRunning(false); setLeft(total); }} data-scan-item>Reset</button>
      </div>
      <div className="row-center wrap" data-scan-group>
        {PRESETS.map((m) => (
          <button key={m} className={`btn ${total === m * 60 ? 'primary' : ''}`} data-scan-item
            onClick={() => { setRunning(false); setTotal(m * 60); setLeft(m * 60); }}>{m} min</button>
        ))}
      </div>
    </div>
  );
}
