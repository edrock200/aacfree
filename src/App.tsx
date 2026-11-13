import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useStore, useProfile } from './store';
import { MessageBar } from './components/MessageBar';
import { QuickBar } from './components/QuickBar';
import { NavBar } from './components/NavBar';
import { FormsPopover } from './components/FormsPopover';
import { FindWord } from './components/FindWord';
import { BigText } from './components/BigText';
import { LoadProblemBanner } from './components/LoadProblemBanner';
import { ButtonEditor } from './components/ButtonEditor';
import { TalkScreen } from './screens/TalkScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { PhrasesScreen } from './screens/PhrasesScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { Onboarding } from './screens/Onboarding';
import { setPressFeedback } from './lib/usePress';
import { click, setKeepAwake, vibrate } from './lib/feedback';
import { useScanner } from './lib/useScanner';
import { PointerLayer } from './components/PointerLayer';
import { checkNativeLanguage, needsUserGesture, openTtsInstall, primeSpeech, setTtsFailureHandler, type TtsFailure } from './lib/tts';
import { IconLock, IconSpeak, IconUnlock } from './components/Icons';
import { PressButton } from './components/PressButton';
import { useAccessStyles } from './lib/rings';
import type { AACButton } from './types';
import { setLangs, t } from './i18n';

/** Web speech failures: what happened and how to fix it (translated at display time). */
const TTS_FAILURE_MESSAGES: Record<Exclude<TtsFailure, 'native' | 'not-allowed'>, string> = {
  'no-engine': "This browser can't speak. Try Chrome, Edge or Safari, or install the Caleb app on Android.",
  'no-voices': "No voices are installed. Add a voice in your device's text-to-speech settings, then open Caleb again.",
  error: "The voice didn't work. Check the volume and the speech settings, then try again.",
};

// Grown-up screens (settings, backup, OBF, sync, insights) load on first use; the chunk is precached offline.
const GrownUpScreen = lazy(() => import('./screens/GrownUpScreen').then((m) => ({ default: m.GrownUpScreen })));

export function App() {
  const loaded = useStore((s) => s.loaded);
  const onboarded = useStore((s) => s.data.onboarded);
  if (!loaded) return <div className="splash"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /><b>{t('Caleb')}</b></div>;
  if (!onboarded) return <Onboarding />;
  return <LangMain />;
}

/** The whole UI remounts when the language changes so every string re-translates. */
function LangMain() {
  const s = useProfile().settings;
  const comm = s.language ?? 'en';
  const ui = s.uiLanguage && s.uiLanguage !== 'auto' ? s.uiLanguage : comm;
  setLangs(ui, comm);
  document.documentElement.lang = ui;
  return <Main key={`${ui}-${comm}-${s.secondLabel ?? ''}`} />;
}

function Main() {
  const p = useProfile();
  const s = p.settings;
  const screen = useStore((st) => st.screen);
  const toast = useStore((st) => st.toast);
  const toastAction = useStore((st) => st.toastAction);
  const saveError = useStore((st) => st.saveError);
  const formsFor = useStore((st) => st.formsFor);
  const boardStack = useStore((st) => st.boardStack);
  const editMode = useStore((st) => st.editMode);
  const bigText = useStore((st) => st.bigText);
  const { back, setScreen, updateProfile, setBigText } = useStore.getState();
  const [finding, setFinding] = useState(false);
  const [qbEdit, setQbEdit] = useState<{ index: number; button: AACButton | null } | null>(null);

  // Theme + sizing.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    root.dataset.style = s.style;
    root.dataset.motion = s.reduceMotion ? 'reduce' : 'full';
    root.style.setProperty('--font-scale', String(s.fontScale));
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.theme === 'light' ? '#f6f3ee' : '#15171c');
  }, [s.theme, s.style, s.fontScale, s.reduceMotion]);

  useEffect(() => {
    setPressFeedback(() => {
      if (s.clickSound) click();
      if (s.haptics) vibrate();
    });
  }, [s.clickSound, s.haptics]);

  useEffect(() => { setKeepAwake(s.keepAwake); }, [s.keepAwake]);
  useAccessStyles(s);

  // Grown-up mode re-locks itself after 5 idle minutes, or after the app has been in the background
  // for over a minute (short trips, like taking a photo for a button, don't lock).
  // Only grown-up activity counts: talking on an unlocked device must not keep it unlocked forever.
  const unlocked = useStore((st) => st.unlocked);
  useEffect(() => {
    if (!unlocked) return;
    const relock = () => {
      const st = useStore.getState();
      // Outside Settings, just lock: never move the person off the board they are using.
      if (st.screen === 'grownup') st.lock();
      else st.setUnlocked(false);
    };
    let idle = setTimeout(relock, 5 * 60 * 1000);
    let hiddenAt = 0;
    const bump = () => {
      const st = useStore.getState();
      if (st.screen !== 'grownup' && !st.editMode && !st.contentEdit) return;
      clearTimeout(idle);
      idle = setTimeout(relock, 5 * 60 * 1000);
    };
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60 * 1000) relock();
    };
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [unlocked]);

  // Browsers may refuse speech until a real touch or key press; dwell, head and eye clicks don't count.
  const [needGesture, setNeedGesture] = useState(() => s.pointer !== 'off' && needsUserGesture());
  // Speech must never fail silently: a calm message that says how to fix it.
  useEffect(() => {
    setTtsFailureHandler((kind) => {
      const st = useStore.getState();
      // Clear-after-speak must not lose a message that was never heard.
      if (st.settings().clearAfterSpeak) st.restoreLastSpoken();
      if (kind === 'native') st.showToast(t('Speech is not working on this device.'), { label: 'Install voices', run: openTtsInstall });
      else if (kind === 'not-allowed') { setNeedGesture(true); st.showToast(t('Tap the screen once to turn the voice on.')); }
      else st.showToast(t(TTS_FAILURE_MESSAGES[kind]));
    });
    return () => setTtsFailureHandler(null);
  }, []);
  useEffect(() => {
    const onGesture = (e: Event) => {
      if (!e.isTrusted) return;
      primeSpeech();
      setNeedGesture(false);
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    };
  }, []);
  useEffect(() => {
    checkNativeLanguage(s.lang).then((fallback) => fallback && useStore.getState().updateSettings({ lang: fallback, voiceName: undefined, voiceIndex: undefined }));
  }, [s.lang]);

  // Android back button: navigate inside Caleb, never exit by accident.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      const st = useStore.getState();
      // Close the top-most dialog first (dialogs close on Escape).
      if (document.querySelector('.modal-root, .bigtext, [role="dialog"]')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (st.formsFor) return st.setFormsFor(null);
      // Inside a tool, Back returns to the Tools menu first.
      if (st.screen === 'tools' && st.tool) return st.setTool(null);
      if (st.screen !== 'talk') return setScreen('talk');
      if (st.boardStack.length > 1) return back();
    });
    return () => { h.then((x) => x.remove()); };
  }, [back, setScreen]);

  useScanner(s, s.scanning && screen !== 'grownup' && !editMode, `${screen}-${boardStack.join('/')}-${!!formsFor}-${finding}-${!!bigText}`);


  return (
    <div className={`app screen-${screen} ${editMode ? 'editing' : ''}`}>
      <LoadProblemBanner />
      {saveError && (
        <div className="save-error scan-exempt" role="alert">
          ⚠ {t("Changes aren't being saved (device storage may be full).")}
          <button className="btn small" onClick={async () => {
            const { createBackup, backupFilename } = await import('./lib/backup');
            const { saveFile } = await import('./lib/files');
            saveFile(backupFilename(p.name), await createBackup(useStore.getState().data));
          }}>{t('Save a backup file now')}</button>
        </div>
      )}
      {unlocked && screen !== 'grownup' && (
        <div className="unlocked-banner scan-exempt pointer-exempt" role="status">
          <IconUnlock size={18} /> <span>{t('Editing unlocked')}</span>
          <button className="btn small" onClick={() => useStore.getState().setUnlocked(false)}><IconLock size={16} /> {t('Lock')}</button>
        </div>
      )}
      {needGesture && screen !== 'grownup' && (
        <button className="voice-gate scan-exempt pointer-exempt" onClick={() => setNeedGesture(false)}>
          <IconSpeak size={22} /> {t('Tap once to turn the voice on')}
        </button>
      )}
      {screen !== 'grownup' && <MessageBar onShow={setBigText} />}
      {screen !== 'grownup' && s.showQuickBar && <QuickBar onEdit={(index, button) => setQbEdit({ index, button })} />}
      <main className="main">
        {screen === 'talk' && <TalkScreen />}
        {screen === 'keyboard' && <KeyboardScreen />}
        {screen === 'phrases' && <PhrasesScreen />}
        {screen === 'tools' && <ToolsScreen />}
        {screen === 'grownup' && <Suspense fallback={<div className="grownup" aria-busy />}><GrownUpScreen /></Suspense>}
      </main>
      <NavBar onFind={() => setFinding(true)} />
      {formsFor && <MessageWordForms />}
      {finding && <FindWord onClose={() => setFinding(false)} />}
      {bigText !== null && <BigText text={bigText} onClose={() => setBigText(null)} />}
      {qbEdit && (
        <ButtonEditor
          button={qbEdit.button}
          boards={[]}
          allowFolder={false}
          onClose={() => setQbEdit(null)}
          onSave={(b) => {
            updateProfile((pp) => {
              if (qbEdit.index >= pp.quickBar.length) pp.quickBar.push(b);
              else pp.quickBar[qbEdit.index] = b;
            }, { undoable: true });
            setQbEdit(null);
          }}
          onDelete={() => {
            updateProfile((pp) => { pp.quickBar.splice(qbEdit.index, 1); }, { undoable: true });
            setQbEdit(null);
          }}
        />
      )}
      <TimerChip />
      <PointerLayer s={s} active={screen !== 'grownup' && !editMode} />
      {toast && (
        // scan-exempt: a helper can tap Undo while scanning; the action is also a scan item for the switch user.
        <div className="toast scan-exempt" role="status" data-scan-group>
          {toast}
          {toastAction && (
            <PressButton className="toast-action" data-scan-item onPress={() => { toastAction.run(); useStore.setState({ toast: null, toastAction: null }); }}>{t(toastAction.label)}</PressButton>
          )}
        </div>
      )}
    </div>
  );
}

/** Word-forms popover for a word in the message bar (own component so the shell doesn't re-render per word). */
function MessageWordForms() {
  const formsFor = useStore((st) => st.formsFor);
  const fw = useStore((st) => (st.formsFor ? st.message[st.formsFor.index] : null));
  const { setFormsFor, replaceWord, removeWord } = useStore.getState();
  if (!formsFor || !fw) return null;
  return (
    <FormsPopover
      word={fw.base ?? fw.text}
      type={fw.type}
      symbol={fw.symbol}
      onClose={() => setFormsFor(null)}
      onPick={(f) => replaceWord(formsFor.index, f)}
      onRemove={() => removeWord(formsFor.index)}
    />
  );
}

/** Small countdown chip shown on every screen while the visual timer runs. */
function TimerChip() {
  const timer = useStore((st) => st.timer);
  const onTimer = useStore((st) => st.screen === 'tools' && st.tool === 'timer');
  if (!timer.endAt || onTimer) return null;
  const mm = Math.floor(timer.left / 60);
  const ss = String(timer.left % 60).padStart(2, '0');
  const frac = timer.total ? timer.left / timer.total : 0;
  return (
    <PressButton className="timer-chip" aria-label={t('Timer: {m} minutes {s} seconds left', { m: mm, s: ss })} data-scan-group data-scan-item
      onPress={() => { useStore.getState().setScreen('tools'); useStore.getState().setTool('timer'); }}>
      <span className="timer-chip-dial" style={{ background: `conic-gradient(var(--timer) ${frac * 360}deg, var(--timer-bg) 0)` }} />
      {mm}:{ss}
    </PressButton>
  );
}
