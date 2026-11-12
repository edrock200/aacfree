import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useSettings } from '../store';

/** PIN or math-question gate for the grown-up area. */
export function LockGate({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const s = useSettings();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { text: `${a} × ${b}`, answer: String(a * b) };
  }, []);

  const target = s.lock === 'pin' ? s.pin ?? '' : q.answer;

  const press = (d: string) => {
    const next = (entry + d).slice(0, 6);
    setEntry(next);
    setError(false);
    if (next === target) onUnlock();
    else if (next.length >= target.length) {
      setError(true);
      setTimeout(() => setEntry(''), 500);
    }
  };

  return (
    <Modal title="Grown-ups only" onClose={onClose}>
      <div className="lockgate">
        <p className="center">{s.lock === 'pin' ? 'Enter your PIN' : <>What is <b>{q.text}</b>?</>}</p>
        <div className={`pin-dots ${error ? 'shake' : ''}`}>
          {s.lock === 'pin'
            ? Array.from({ length: target.length }, (_, i) => <i key={i} className={i < entry.length ? 'on' : ''} />)
            : <span className="pin-entry">{entry || ' '}</span>}
        </div>
        <div className="pinpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
            d === '' ? <span key={i} /> : (
              <button key={i} className="btn" onClick={() => (d === '⌫' ? setEntry(entry.slice(0, -1)) : press(d))}>{d}</button>
            ),
          )}
        </div>
        {s.lock === 'pin' && <p className="muted small center">Forgot the PIN? Clear the app's data or reinstall — then restore from a backup.</p>}
      </div>
    </Modal>
  );
}
