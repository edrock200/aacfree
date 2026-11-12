import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useLock, useStore } from '../store';
import { t } from '../i18n';

/**
 * Gentle back-off for wrong answers. Kept outside the component so closing and
 * reopening the gate doesn't reset it. It is a child gate, not a vault: the
 * waits are short and never lock a grown-up out for long.
 */
const tries = { wrong: 0, until: 0 };
export const backoffMs = (wrong: number) => (wrong < 3 ? 0 : Math.min(60_000, 5000 * 2 ** (wrong - 3)));
/** For tests. */
export const resetLockBackoff = () => { tries.wrong = 0; tries.until = 0; };

/** PIN or math-question gate for the grown-up area. */
export function LockGate({ onUnlock, onClose, method }: { onUnlock: () => void; onClose: () => void; method?: 'pin' | 'math' }) {
  const s = useLock(); // app-wide lock and PIN
  const usePin = (method ?? (s.lock === 'pin' ? 'pin' : 'math')) === 'pin' && !!s.pin;
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { text: `${a} × ${b}`, answer: String(a * b) };
  }, []);

  const target = usePin ? s.pin ?? '' : q.answer;
  const [recover, setRecover] = useState(false);
  const [held, setHeld] = useState(false);
  const [phrase, setPhrase] = useState('');
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const PHRASE = t('I am a grown-up');

  const waitMs = Math.max(0, tries.until - now);
  useEffect(() => {
    if (!waitMs) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waitMs]);

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
            {held ? t('✓ Held') : t('1. Press and hold here for 10 seconds')}
          </button>
          <label className="field"><span>{t('2. Type:')} <b>{PHRASE}</b></span>
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn primary" disabled={!ok} onClick={() => {
            useStore.getState().setLock({ lock: 'hold', pin: undefined });
            useStore.getState().showToast(t('PIN removed. Set a new one in Grown-ups → Lock.'));
            resetLockBackoff();
            onUnlock();
          }}>{t('Remove PIN and open Grown-ups')}</button>
        </div>
      </Modal>
    );
  }

  const wrong = () => {
    tries.wrong += 1;
    tries.until = Date.now() + backoffMs(tries.wrong);
    setNow(Date.now());
    setError(true);
    setTimeout(() => setEntry(''), 500);
  };

  const press = (d: string) => {
    if (waitMs) return;
    const next = (entry + d).slice(0, 6);
    setEntry(next);
    setError(false);
    if (next === target) { resetLockBackoff(); onUnlock(); return; }
    // A PIN is checked as it is typed and on OK, so the dots never give its length away.
    if (usePin ? next.length >= 6 : next.length >= target.length) wrong();
  };
  const submit = () => {
    if (waitMs || !entry) return;
    if (entry === target) { resetLockBackoff(); onUnlock(); } else wrong();
  };

  const waitSec = Math.ceil(waitMs / 1000);
  return (
    <Modal title={t('Grown-ups only')} onClose={onClose} rootClassName="scan-exempt">
      <div className="lockgate">
        <p className="center">{usePin ? t('Enter your PIN') : t('What is {q}?', { q: q.text })}</p>
        <div className={`pin-dots ${error ? 'shake' : ''}`} aria-hidden>
          {usePin
            ? Array.from({ length: entry.length }, (_, i) => <i key={i} className="on" />)
            : <span className="pin-entry">{entry || ' '}</span>}
        </div>
        <p className="lockgate-msg" role="alert">
          {waitMs ? t('Too many tries. Please wait {n} seconds.', { n: waitSec }) : error ? t(usePin ? 'That PIN is not right. Try again.' : 'Not quite. Try again.') : ''}
        </p>
        <div className="pinpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((d, i) =>
            d === 'OK' && !usePin ? <span key={i} /> : (
              <button key={i} className={`btn ${d === 'OK' ? 'primary' : ''}`} disabled={!!waitMs}
                aria-label={d === '⌫' ? t('Delete') : d === 'OK' ? t('OK') : undefined}
                onClick={() => (d === '⌫' ? setEntry(entry.slice(0, -1)) : d === 'OK' ? submit() : press(d))}>{d === 'OK' ? t('OK') : d}</button>
            ),
          )}
        </div>
        {usePin && <button className="btn small" onClick={() => setRecover(true)}>{t('Forgot PIN?')}</button>}
      </div>
    </Modal>
  );
}
