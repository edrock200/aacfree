import { useRef, useState } from 'react';
import { useStore, useSettings, type Screen } from '../store';
import { IconChat, IconEdit, IconKeyboard, IconLock, IconSearch, IconSettings, IconTools, IconUnlock } from './Icons';
import { LockGate } from './LockGate';
import { usePress } from '../lib/usePress';

const HOLD_MS = 2000;

export function NavBar({ onFind }: { onFind: () => void }) {
  const s = useSettings();
  const screen = useStore((st) => st.screen);
  const unlocked = useStore((st) => st.unlocked);
  const editMode = useStore((st) => st.editMode);
  const { setScreen, setUnlocked, setEditMode } = useStore.getState();
  const [gate, setGate] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [holding, setHolding] = useState(false);

  const go = (sc: Screen) => setScreen(screen === sc ? 'talk' : sc);

  const openGrownUps = () => {
    setUnlocked(true);
    setScreen('grownup');
  };

  const lockDown = () => {
    if (unlocked) return;
    if (s.lock === 'hold' || s.scanning) {
      setHolding(true);
      holdTimer.current = setTimeout(() => {
        setHolding(false);
        if (s.scanning && s.lock === 'hold') openGrownUps();
        else if (s.lock === 'hold') openGrownUps();
        else setGate(true);
      }, HOLD_MS);
    }
  };
  const lockUp = () => {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };
  const lockClick = () => {
    if (unlocked) return setScreen(screen === 'grownup' ? 'talk' : 'grownup');
    if (s.lock === 'none') return openGrownUps();
    if (s.lock === 'hold' || s.scanning) return; // handled by hold
    setGate(true);
  };

  const pressOpts = { holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown };
  const kb = usePress({ ...pressOpts, onActivate: () => go('keyboard') });
  const ph = usePress({ ...pressOpts, onActivate: () => go('phrases') });
  const tl = usePress({ ...pressOpts, onActivate: () => go('tools') });
  const fd = usePress({ ...pressOpts, onActivate: onFind });

  return (
    <nav className="navbar" data-scan-group>
      {s.showKeyboardNav && (
        <button className={`navbtn ${screen === 'keyboard' ? 'on' : ''}`} data-scan-item aria-label="Keyboard" {...kb}><IconKeyboard /><span>Keyboard</span></button>
      )}
      {s.showPhrasesNav && (
        <button className={`navbtn ${screen === 'phrases' ? 'on' : ''}`} data-scan-item aria-label="Phrases" {...ph}><IconChat /><span>Phrases</span></button>
      )}
      {s.showToolsNav && (
        <button className={`navbtn ${screen === 'tools' ? 'on' : ''}`} data-scan-item aria-label="Tools" {...tl}><IconTools /><span>Tools</span></button>
      )}
      <button className="navbtn" data-scan-item aria-label="Find a word" {...fd}><IconSearch /><span>Find</span></button>
      <span className="spacer" />
      {unlocked && (
        <button className={`navbtn ${editMode ? 'on' : ''}`} onClick={() => setEditMode(!editMode)} aria-label="Edit boards"><IconEdit /><span>{editMode ? 'Editing' : 'Edit'}</span></button>
      )}
      {unlocked && (
        <button className="navbtn" onClick={() => { setUnlocked(false); setScreen('talk'); }} aria-label="Lock"><IconLock /><span>Lock</span></button>
      )}
      <button
        className={`navbtn lockbtn scan-exempt ${holding ? 'holding' : ''} ${screen === 'grownup' ? 'on' : ''}`}
        style={{ ['--hold-ms' as string]: `${HOLD_MS}ms` }}
        aria-label={unlocked ? 'Grown-up settings' : 'Grown-ups (hold)'}
        onPointerDown={lockDown}
        onPointerUp={lockUp}
        onPointerLeave={lockUp}
        onPointerCancel={lockUp}
        onClick={lockClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {unlocked ? <IconSettings /> : <IconUnlock />}
        <span>{unlocked ? 'Grown-ups' : holding ? 'Keep holding…' : 'Grown-ups'}</span>
      </button>
      {gate && <LockGate onClose={() => setGate(false)} onUnlock={() => { setGate(false); openGrownUps(); }} />}
    </nav>
  );
}
