import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useStore, useProfile } from './store';
import { MessageBar } from './components/MessageBar';
import { QuickBar } from './components/QuickBar';
import { NavBar } from './components/NavBar';
import { FormsPopover } from './components/FormsPopover';
import { FindWord } from './components/FindWord';
import { BigText } from './components/BigText';
import { ButtonEditor } from './components/ButtonEditor';
import { TalkScreen } from './screens/TalkScreen';
import { KeyboardScreen } from './screens/KeyboardScreen';
import { PhrasesScreen } from './screens/PhrasesScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { GrownUpScreen } from './screens/GrownUpScreen';
import { Onboarding } from './screens/Onboarding';
import { setPressFeedback } from './lib/usePress';
import { click, setKeepAwake, vibrate } from './lib/feedback';
import { useScanner } from './lib/useScanner';
import { checkNativeLanguage, openTtsInstall, setTtsFailureHandler } from './lib/tts';
import type { AACButton } from './types';

export function App() {
  const loaded = useStore((s) => s.loaded);
  const onboarded = useStore((s) => s.data.onboarded);
  if (!loaded) return <div className="splash"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /><b>Caleb</b></div>;
  if (!onboarded) return <Onboarding />;
  return <Main />;
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
  const { back, setScreen, updateProfile } = useStore.getState();
  const [finding, setFinding] = useState(false);
  const [bigText, setBigText] = useState<string | null>(null);
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

  // Speech must never fail silently.
  useEffect(() => {
    setTtsFailureHandler(() => useStore.getState().showToast('Speech is not working on this device.', { label: 'Install voices', run: openTtsInstall }));
    return () => setTtsFailureHandler(null);
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
      if (document.querySelector('.modal-root, .bigtext')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (st.formsFor) return st.setFormsFor(null);
      if (st.screen !== 'talk') return setScreen('talk');
      if (st.boardStack.length > 1) return back();
    });
    return () => { h.then((x) => x.remove()); };
  }, [back, setScreen]);

  useScanner(s, s.scanning && screen !== 'grownup' && !editMode, `${screen}-${boardStack.join('/')}-${!!formsFor}-${finding}-${!!bigText}`);


  return (
    <div className={`app screen-${screen} ${editMode ? 'editing' : ''}`}>
      {saveError && (
        <div className="save-error" role="alert">
          ⚠ Changes aren't being saved (device storage may be full).
          <button className="btn small" onClick={async () => {
            const { createBackup, backupFilename } = await import('./lib/backup');
            const { saveFile } = await import('./lib/files');
            saveFile(backupFilename(p.name), await createBackup(useStore.getState().data));
          }}>Save a backup file now</button>
        </div>
      )}
      {screen !== 'grownup' && <MessageBar onShow={setBigText} />}
      {screen !== 'grownup' && s.showQuickBar && <QuickBar onEdit={(index, button) => setQbEdit({ index, button })} />}
      <main className="main">
        {screen === 'talk' && <TalkScreen />}
        {screen === 'keyboard' && <KeyboardScreen />}
        {screen === 'phrases' && <PhrasesScreen />}
        {screen === 'tools' && <ToolsScreen />}
        {screen === 'grownup' && <GrownUpScreen />}
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
      {toast && (
        <div className="toast" role="status">
          {toast}
          {toastAction && (
            <button className="toast-action" onClick={() => { toastAction.run(); useStore.setState({ toast: null, toastAction: null }); }}>{toastAction.label}</button>
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
      word={fw.text}
      type={fw.type}
      symbol={fw.symbol}
      onClose={() => setFormsFor(null)}
      onPick={(f) => replaceWord(formsFor.index, f)}
      onRemove={() => removeWord(formsFor.index)}
    />
  );
}
