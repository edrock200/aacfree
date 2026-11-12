import { useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useLock, useStore } from '../store';
import { t } from '../i18n';

/** PIN or math-question gate for the grown-up area. */
export function LockGate({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const s = useLock(); // app-wide lock and PIN
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { text: `${a} × ${b}`, answer: String(a * b) };
  }, []);

  const target = s.lock === 'pin' ? s.pin ?? '' : q.answer;
  const [recover, setRecover] = useState(false);
  const [held, setHeld] = useState(false);
  const [phrase, setPhrase] = useState('');
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const PHRASE = 'I am a grown-up';

  if (recover) {
    const ok = held && phrase.trim().toLowerCase() === PHRASE.toLowerCase();
    return (
      <Modal title={t('Forgot the PIN?')} onClose={onClose} rootClassName="scan-exempt">
        <div className="lockgate">
          <p className="small">{t('This removes the PIN without touching any boards. Then you can set a new one.')}</p>
          <button className={`btn big ${held ? 'primary' : ''} hold10`}
            onPointerDown={() => { holdTimer.current = setTimeout(() => setHeld(true), 10000); }}
            onPointerUp={() => clearTimeout(holdTimer.current)} onPointerLeave={() => clearTimeout(holdTimer.current)}
            onContextMenu={(e) => e.preventDefault()}>
            {held ? '✓ Held' : '1. Press and hold here for 10 seconds'}
          </button>
          <label className="field"><span>{t('2. Type:')} <b>{PHRASE}</b></span>
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn primary" disabled={!ok} onClick={() => {
            useStore.getState().setLock({ lock: 'hold', pin: undefined });
            useStore.getState().showToast(t('PIN removed. Set a new one in Grown-ups → Lock.'));
            onUnlock();
          }}>{t('Remove PIN and open Grown-ups')}</button>
        </div>
      </Modal>
    );
  }

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
    <Modal title={t('Grown-ups only')} onClose={onClose} rootClassName="scan-exempt">
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
        {s.lock === 'pin' && <button className="btn small" onClick={() => setRecover(true)}>{t('Forgot PIN?')}</button>}
      </div>
    </Modal>
  );
}
