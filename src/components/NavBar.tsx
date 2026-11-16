import { useRef, useState, type MouseEvent } from 'react';
import { useStore, useSettings, useLock, useProfile, type Screen } from '../store';
import { IconChat, IconEdit, IconHome, IconKeyboard, IconLock, IconMore, IconPerson, IconSearch, IconSettings, IconTools } from './Icons';
import { LockGate } from './LockGate';
import { usePress } from '../lib/usePress';
import { t } from '../i18n';

const HOLD_MS = 2000;

export function NavBar({ onFind }: { onFind: () => void }) {
  const s = { ...useSettings(), ...useLock() }; // the lock is app-wide
  const screen = useStore((st) => st.screen);
  const unlocked = useStore((st) => st.unlocked);
  const editMode = useStore((st) => st.editMode);
  const modeling = useStore((st) => st.modeling);
  const boardStack = useStore((st) => st.boardStack);
  const profile = useProfile();
  // The "More" board of the built-in layouts (imported boards may not have one).
  const hasMore = Object.hasOwn(profile.boards, 'more') && profile.rootId !== 'more';
  const atHome = screen === 'talk' && boardStack.length === 1;
  const atMore = screen === 'talk' && boardStack.length === 2 && boardStack[1] === 'more';
  const { setScreen, setUnlocked, setEditMode, lock, setTool, setModeling } = useStore.getState();
  const [gate, setGate] = useState<false | 'auto' | 'math'>(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [holding, setHolding] = useState(false);

  const go = (sc: Screen) => {
    // Inside a tool, "Tools" goes back to the tools menu rather than leaving.
    if (sc === 'tools' && screen === 'tools' && useStore.getState().tool) return setTool(null);
    setScreen(screen === sc ? 'talk' : sc);
  };

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
        else setGate('auto');
      }, HOLD_MS);
    }
  };
  const lockUp = () => {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };
  const lockClick = (e: MouseEvent) => {
    if (unlocked) return setScreen(screen === 'grownup' ? 'talk' : 'grownup');
    if (s.lock === 'none') return openGrownUps();
    // Keyboard and screen-reader activation (detail 0) can't hold: ask the grown-up question instead.
    // (Scanning and dwell never target this button: it is scan-exempt.)
    if (e.detail === 0 && s.lock === 'hold') return setGate('math');
    if (s.lock === 'hold' || s.scanning) return; // handled by hold
    setGate('auto');
  };

  const pressOpts = { holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown };
  const kb = usePress({ ...pressOpts, onActivate: () => go('keyboard') });
  const ph = usePress({ ...pressOpts, onActivate: () => go('phrases') });
  const tl = usePress({ ...pressOpts, onActivate: () => go('tools') });
  // Same as the Home button at the top left.
  const hm = usePress({ ...pressOpts, onActivate: () => useStore.getState().home() });
  // Home → More, in one press.
  const mr = usePress({ ...pressOpts, onActivate: () => { const st = useStore.getState(); st.home(); st.openBoard('more'); } });
  const fd = usePress({ ...pressOpts, onActivate: onFind });

  return (
    <nav className="navbar" data-scan-group>
      {s.showKeyboardNav && (
        <button className={`navbtn ${screen === 'keyboard' ? 'on' : ''}`} data-scan-item aria-label={t('Keyboard')} {...kb}><IconKeyboard /><span>{t('Keyboard')}</span></button>
      )}
      {s.showPhrasesNav && (
        <button className={`navbtn ${screen === 'phrases' ? 'on' : ''}`} data-scan-item aria-label={t('Phrases')} {...ph}><IconChat /><span>{t('Phrases')}</span></button>
      )}
      <button className={`navbtn nav-home2 ${atHome ? 'on' : ''}`} data-scan-item aria-label={t('Home')} {...hm}><IconHome /><span>{t('Home')}</span></button>
      {hasMore && (
        <button className={`navbtn nav-more ${atMore ? 'on' : ''}`} data-scan-item aria-label={t('More')} {...mr}><IconMore /><span>{t('More')}</span></button>
      )}
      {s.showToolsNav && (
        <button className={`navbtn ${screen === 'tools' ? 'on' : ''}`} data-scan-item aria-label={t('Tools')} {...tl}><IconTools /><span>{t('Tools')}</span></button>
      )}
      <button className="navbtn" data-scan-item aria-label={t('Find a word')} {...fd}><IconSearch /><span>{t('Find')}</span></button>
      {(s.logging || s.learnWords) && (
        <button className={`navbtn scan-exempt ${modeling ? 'on modeling' : ''}`} onClick={() => setModeling(!modeling)} aria-pressed={modeling}
          aria-label={t('Modelling mode: partner taps are not counted')} title={t("Modelling: your taps aren't counted as the user's")}>
          <IconPerson /><span>{t(modeling ? 'Modelling' : 'Model')}</span>
        </button>
      )}
      <span className="spacer" />
      {unlocked && (
        // Grown-up controls stay tappable while scanning (scan-exempt).
        <button className={`navbtn scan-exempt ${editMode ? 'on' : ''}`} onClick={() => setEditMode(!editMode)} aria-label={t('Edit boards')}><IconEdit /><span>{t(editMode ? 'Editing' : 'Edit')}</span></button>
      )}
      {unlocked && (
        <button className="navbtn nav-lock scan-exempt" onClick={lock} aria-label={t('Lock')}><IconLock /><span>{t('Lock')}</span></button>
      )}
      <button
        className={`navbtn lockbtn scan-exempt ${holding ? 'holding' : ''} ${screen === 'grownup' ? 'on' : ''}`}
        style={{ ['--hold-ms' as string]: `${HOLD_MS}ms` }}
        aria-label={unlocked ? t('Settings') : t('Settings (hold)')}
        onPointerDown={lockDown}
        onPointerUp={lockUp}
        onPointerLeave={lockUp}
        onPointerCancel={lockUp}
        onClick={lockClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {unlocked ? <IconSettings /> : <IconLock />}
        <span>{t(unlocked ? 'Settings' : holding ? 'Keep holding…' : 'Settings')}</span>
      </button>
      {gate && <LockGate method={gate === 'math' ? 'math' : undefined} onClose={() => setGate(false)} onUnlock={() => { setGate(false); openGrownUps(); }} />}
    </nav>
  );
}
