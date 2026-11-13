import { useEffect, useRef, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { listVoices, speak, type VoiceInfo } from '../../lib/tts';
import { Capacitor } from '@capacitor/core';
import { Choice, Section, Slider, Toggle } from './controls';
import { WORD_COLORS } from '../../lib/colors';
import { GazeCalibration } from '../../components/GazeCalibration';
import { Modal } from '../../components/Modal';
import { keyName } from '../../lib/scanner';
import { HIGHLIGHT_COLORS, ringWidth } from '../../lib/rings';
import { LANGUAGES, PACKS, getUiLang, tIn, ts, type Lang } from '../../i18n';
import { t } from '../../i18n';
import { keepAwakeAvailable } from '../../lib/wakelock';

/** A language code ("es", "pt") as a name the grown-up can read, in the app language. */
function languageName(code: string): string {
  const own = LANGUAGES.find((l) => l.id === code);
  try {
    const n = new Intl.DisplayNames([getUiLang()], { type: 'language' }).of(code);
    if (n && n !== code) return n.charAt(0).toLocaleUpperCase(getUiLang()) + n.slice(1);
  } catch { /* older WebView */ }
  return own?.name ?? code;
}

export function SpeechPanel() {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings } = useStore.getState();
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  // Start with voices for the language the person talks in (a Spanish profile sees Spanish voices).
  const [filter, setFilter] = useState<string>(s.language ?? 'en');
  const native = Capacitor.isNativePlatform();

  useEffect(() => { listVoices().then(setVoices); }, []);
  const shown = voices.filter((v) => !filter || v.lang.toLowerCase().startsWith(filter));
  const current = native ? String(s.voiceIndex ?? '') : s.voiceURI ?? '';

  return (
    <>
      <Section title={t('Voice')} intro={t('Pick a voice that sounds right to the person, and let them choose if they can. Voices come from the device; on Android you can install more in Settings → Text-to-speech.')}>
        <div className="setting">
          <span className="setting-text"><b>{t('Language filter')}</b></span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t('All languages')}</option>
            {[...new Set([filter, ...voices.map((v) => v.lang.slice(0, 2).toLowerCase())].filter(Boolean))]
              .map((l) => ({ l, name: languageName(l) })).sort((a, b) => a.name.localeCompare(b.name))
              .map(({ l, name }) => <option key={l} value={l}>{name}</option>)}
          </select>
        </div>
        <div className="voice-list">
          <button className={`voice ${!current ? 'on' : ''}`} onClick={() => {
            // The device default voice for the communication language.
            const patch = { voiceURI: undefined, voiceIndex: undefined, voiceName: undefined, lang: PACKS[(s.language ?? 'en') as Lang].voice };
            updateSettings(patch);
            speak(ts("Hi, I'm {name}. This is my voice.", { name: p.name || 'Caleb' }), { ...s, ...patch });
          }}>
            <b>{t('Device default')}</b><small>{PACKS[(s.language ?? 'en') as Lang].voice}</small>
          </button>
          {shown.map((v) => (
            <button key={v.id} className={`voice ${current === v.id ? 'on' : ''}`} onClick={() => {
              const patch = native ? { voiceIndex: Number(v.id), voiceName: v.name, lang: v.lang } : { voiceURI: v.id, lang: v.lang };
              updateSettings(patch);
              speak(ts("Hi, I'm {name}. This is my voice.", { name: p.name || 'Caleb' }), { ...s, ...patch });
            }}>
              <b>{v.name}</b><small>{v.lang}{v.local ? '' : ' · online'}</small>
            </button>
          ))}
          {voices.length === 0 && <p className="muted">{t('No voices found. On Android, install “Speech Services by Google” from the Play Store.')}</p>}
        </div>
        <Slider label={t('Speed')} value={s.rate} min={0.5} max={1.8} step={0.05} onChange={(rate) => updateSettings({ rate })} format={(v) => `${v.toFixed(2)}×`} />
        <Slider label={t('Pitch')} value={s.pitch} min={0.5} max={1.8} step={0.05} onChange={(pitch) => updateSettings({ pitch })} format={(v) => v.toFixed(2)} />
        <Slider label={t('Volume')} value={s.volume} min={0.1} max={1} step={0.05} onChange={(volume) => updateSettings({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
        <button className="btn primary" onClick={() => speak(ts('I want to go to the park, please.'), s)}>{t('Test voice')}</button>
      </Section>
      <Pronunciations />
      <Section title={t('Speaking')}>
        <Toggle label={t('Speak each word when tapped')} hint={t('Turn off for silent sentence building.')} checked={s.speakOnTap} onChange={(speakOnTap) => updateSettings({ speakOnTap })} />
        <Toggle label={t('Say folder names when opened')} checked={s.speakFolders} onChange={(speakFolders) => updateSettings({ speakFolders })} />
        <Toggle label={t('Clear message after speaking')} checked={s.clearAfterSpeak} onChange={(clearAfterSpeak) => updateSettings({ clearAfterSpeak })} />
        <Toggle label={t('Go back to Home after picking a word in a folder')} hint={t('Fewer taps for the next word.')} checked={s.returnHome} onChange={(returnHome) => updateSettings({ returnHome })} />
      </Section>
    </>
  );
}

export function DisplayPanel() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const [confirmLang, setConfirmLang] = useState<Lang | null>(null);
  const comm = (s.language ?? 'en') as Lang;
  return (
    <>
      <Section title={t('Language')} intro={t('The communication language changes the words on the boards, word forms, the keyboard and the voice. Buttons keep their exact places.')}>
        <Choice label={t('Communication language')} value={comm} onChange={(l) => l !== comm && setConfirmLang(l)}
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.name }))} />
        <Choice label={t('App language')} hint={t('Menus and settings. You can read the app in a different language from the one the person talks in.')} value={s.uiLanguage ?? 'auto'} onChange={(uiLanguage) => updateSettings({ uiLanguage })}
          options={[{ value: 'auto' as const, label: t('Same') }, ...LANGUAGES.map((l) => ({ value: l.id, label: l.name }))]} />
        <Choice label={t('Second language on buttons')} hint={t('Shows each built-in word in a second language under the main word. Helpful for bilingual families and classrooms.')} value={s.secondLabel ?? ''} onChange={(secondLabel) => updateSettings({ secondLabel })}
          options={[{ value: '' as const, label: t('None') }, ...LANGUAGES.filter((l) => l.id !== comm).map((l) => ({ value: l.id, label: l.name }))]} />
        {comm !== 'en' && (
          <Toggle label={t('Conjugate verbs automatically')} hint={t('After a word like “I” or “you”, a verb changes to match it. Long-press a word for other forms.')} checked={s.autoConjugate} onChange={(autoConjugate) => updateSettings({ autoConjugate })} />
        )}
      </Section>
      {confirmLang && (
        <Modal title={tIn(confirmLang, 'Switch to {lang}', { lang: PACKS[confirmLang].name })} onClose={() => setConfirmLang(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirmLang(null)}>{tIn(confirmLang, 'Cancel')}</button>
            <button className="btn primary" onClick={() => { useStore.getState().setLanguage(confirmLang); setConfirmLang(null); }}>{tIn(confirmLang, 'Switch')}</button></>}>
          <p>{tIn(confirmLang, 'Board words, phrases and schedules will be translated. Every button stays in its place. Words you added yourself stay as they are. A snapshot is saved first.')}</p>
        </Modal>
      )}
      <Section title={t('Look')}>
        <Choice label={t('Theme')} value={s.theme} onChange={(theme) => updateSettings({ theme })}
          options={[{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }, { value: 'contrast', label: t('High contrast') }]} />
        <Choice label={t('Style')} hint={t('“Clean” uses simpler button shapes.')} value={s.style} onChange={(style) => updateSettings({ style })}
          options={[{ value: 'playful', label: t('Playful') }, { value: 'clean', label: t('Clean') }]} />
        <Choice label={t('Colour coding')} hint={t('Modified Fitzgerald Key: colours by word type.')} value={s.colorMode} onChange={(colorMode) => updateSettings({ colorMode })}
          options={[{ value: 'fill', label: t('Filled') }, { value: 'border', label: t('Border only') }, { value: 'none', label: t('Off') }]} />
        <div className="legend">
          {(Object.keys(WORD_COLORS) as (keyof typeof WORD_COLORS)[]).filter((k) => k !== 'misc').map((k) => (
            <span key={k} style={{ background: WORD_COLORS[k].light }}>{t(WORD_COLORS[k].name)}</span>
          ))}
        </div>
      </Section>
      <Section title={t('Buttons')}>
        <Toggle label={t('Show words on buttons')} checked={s.showLabels} onChange={(showLabels) => updateSettings({ showLabels })} />
        <Toggle label={t('Words above pictures')} checked={s.labelTop} onChange={(labelTop) => updateSettings({ labelTop })} />
        <Choice label={t('Letter case')} value={s.textCase} onChange={(textCase) => updateSettings({ textCase })}
          options={[{ value: 'as-is', label: t('As written') }, { value: 'lower', label: t('lower') }, { value: 'upper', label: t('UPPER') }]} />
        <Slider label={t('Text size')} value={s.fontScale} min={0.7} max={1.8} step={0.05} onChange={(fontScale) => updateSettings({ fontScale })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label={t('Space between buttons')} value={s.gap} min={0} max={20} onChange={(gap) => updateSettings({ gap })} format={(v) => `${v}px`} />
        <Toggle label={t('Show pictures in the message bar')} checked={s.showSymbolsInBar} onChange={(showSymbolsInBar) => updateSettings({ showSymbolsInBar })} />
      </Section>
      <Section title={t('Screen')}>
        <Toggle label={t('Quick bar (yes, no, stop, help…)')} hint={t('Recommended: keeps protest and help words reachable everywhere.')} checked={s.showQuickBar} onChange={(showQuickBar) => updateSettings({ showQuickBar })} />
        <Toggle label={t('Keyboard button')} checked={s.showKeyboardNav} onChange={(showKeyboardNav) => updateSettings({ showKeyboardNav })} />
        <Toggle label={t('Phrases button')} checked={s.showPhrasesNav} onChange={(showPhrasesNav) => updateSettings({ showPhrasesNav })} />
        <Toggle label={t('Tools button')} checked={s.showToolsNav} onChange={(showToolsNav) => updateSettings({ showToolsNav })} />
        <Toggle label={t('Reduce motion')} checked={s.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} />
        <Toggle label={t('Keep screen awake')} hint={keepAwakeAvailable() ? undefined : t('This browser cannot keep the screen on. Change the sleep time in the device settings instead.')} checked={s.keepAwake} onChange={(keepAwake) => updateSettings({ keepAwake })} />
        <Toggle label={t('Babble mode (show hidden words)')} hint={t("Lets the person explore every word, including ones you've hidden for now.")} checked={s.babble} onChange={(babble) => updateSettings({ babble })} />
      </Section>
    </>
  );
}

export function AccessPanel() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const secs = (v: number) => (v ? `${(v / 1000).toFixed(1)} s` : t('Off'));
  return (
    <>
      <Section title={t('Touch')} intro={t('Adjust these if the person has trouble with accidental taps or holding a finger still.')}>
        <Slider label={t('Hold to select')} hint={t('Finger must stay on a button this long. 0 = off.')} value={s.holdMs} min={0} max={2000} step={100} onChange={(holdMs) => updateSettings({ holdMs })} format={secs} />
        <Slider label={t('Ignore repeated taps')} hint={t('After a selection, ignore taps for this long.')} value={s.debounceMs} min={0} max={2000} step={100} onChange={(debounceMs) => updateSettings({ debounceMs })} format={secs} />
        <Toggle label={t('Select on touch (instead of release)')} hint={t('Fastest for confident users. Long-press for word forms is off with this.')} checked={s.pressOnDown} onChange={(pressOnDown) => updateSettings({ pressOnDown })} />
      </Section>
      <Section title={t('Feedback')}>
        <Toggle label={t('Click sound')} checked={s.clickSound} onChange={(clickSound) => updateSettings({ clickSound })} />
        <Toggle label={t('Vibrate')} checked={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
      </Section>
      <PointerSection />
      <ScanSection />
      <HighlightSection />
    </>
  );
}

/** Switch scanning: mode, timing, switch keys and cues. */
function ScanSection() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const [capture, setCapture] = useState<null | 'select' | 'next'>(null);
  const secs = (v: number) => (v ? `${(v / 1000).toFixed(1)} s` : t('Off'));
  const keyLabel = (k: string, def: string) => (k ? keyName(k) : def);
  const step = s.scanMode === 'step';
  return (
    <Section title={t('Switch scanning')} intro={t('For people who use a switch (or two). Bluetooth switches that act like a keyboard work: Space / Enter, or any key you choose below. Tapping the screen also works as a switch.')}>
      <Toggle label={t('Turn on scanning')} checked={s.scanning} onChange={(scanning) => updateSettings({ scanning })} />
      <Choice label={t('Mode')} value={s.scanMode} onChange={(scanMode) => updateSettings({ scanMode })}
        options={[{ value: 'auto', label: t('1 switch (auto)') }, { value: 'step', label: t('2 switches (step)') }]} />
      <Choice label={t('Pattern')} value={s.scanPattern} onChange={(scanPattern) => updateSettings({ scanPattern })}
        options={[{ value: 'row-col', label: t('Rows, then buttons') }, { value: 'linear', label: t('One by one') }]} />
      {!step && <Slider label={t('Scan speed')} value={s.scanMs} min={500} max={4000} step={100} onChange={(scanMs) => updateSettings({ scanMs })} format={(v) => `${(v / 1000).toFixed(1)} s`} />}
      {!step && <Slider label={t('Extra time on the first item')} hint={t('When scanning starts again or enters a row, the first item stays highlighted a little longer.')} value={s.scanFirstMs ?? 0} min={0} max={3000} step={100} onChange={(scanFirstMs) => updateSettings({ scanFirstMs })} format={secs} />}
      {!step && <Slider label={t('Pause after this many rounds')} hint={t('If nobody presses the switch, scanning rests. The next press starts it again. 0 = never pause.')} value={s.scanLoops ?? 0} min={0} max={10} onChange={(scanLoops) => updateSettings({ scanLoops })} format={(v) => (v ? String(v) : t('Never'))} />}
      <Slider label={t('Switch acceptance time')} hint={t('The switch must be held this long to count. Filters bumps and tremor. 0 = off.')} value={s.scanAcceptMs ?? 0} min={0} max={1000} step={50} onChange={(scanAcceptMs) => updateSettings({ scanAcceptMs })} format={secs} />
      <Slider label={t('Ignore the switch after a selection')} hint={t('Stops a double press or a held switch from choosing again straight away.')} value={s.scanLockoutMs ?? 500} min={0} max={2000} step={100} onChange={(scanLockoutMs) => updateSettings({ scanLockoutMs })} format={secs} />
      {s.scanPattern !== 'linear' && (
        <Toggle label={t('“Leave row” step')} hint={t('After the last button in a row, offer a step that goes back to choosing rows.')} checked={!!s.scanLeaveRow} onChange={(scanLeaveRow) => updateSettings({ scanLeaveRow })} />
      )}
      <Toggle label={t('Speak items while scanning (auditory scanning)')} checked={s.scanSpeak} onChange={(scanSpeak) => updateSettings({ scanSpeak })} />
      {s.scanSpeak && (
        <Toggle label={t('Use a different voice for scan cues')} hint={t('Cues sound softer and higher, so they are easy to tell apart from what the person says.')} checked={!!s.scanCueVoice} onChange={(scanCueVoice) => updateSettings({ scanCueVoice })} />
      )}
      <div className="setting">
        <span className="setting-text"><b>{t(step ? 'Select switch' : 'Your switch')}</b><small>{t('Key: {key}', { key: keyLabel(s.scanKeySelect ?? '', step ? 'Enter' : t('Space, Enter or arrows')) })}</small></span>
        <div className="row">
          <button className="btn small" onClick={() => setCapture('select')}>{t('Set key…')}</button>
          {s.scanKeySelect && <button className="btn small" onClick={() => updateSettings({ scanKeySelect: '' })}>{t('Use default')}</button>}
        </div>
      </div>
      <div className="setting">
        <span className="setting-text"><b>{t('Next switch')}</b><small>{t('Key: {key}', { key: keyLabel(s.scanKeyNext ?? '', step ? t('Space or arrows') : t('none')) })}</small></span>
        <div className="row">
          <button className="btn small" onClick={() => setCapture('next')}>{t('Set key…')}</button>
          {s.scanKeyNext && <button className="btn small" onClick={() => updateSettings({ scanKeyNext: '' })}>{t('Use default')}</button>}
        </div>
      </div>
      <p className="muted small">{t('2-switch mode: Space = next, Enter = select. On a touchscreen: tap = next, long tap = select. To leave scanning, hold the Settings button. While Settings are unlocked, its Edit and Lock buttons can still be tapped.')}</p>
      {capture && (
        <KeyCapture which={capture} onClose={() => setCapture(null)} onKey={(k) => {
          updateSettings(capture === 'select'
            ? { scanKeySelect: k, ...(s.scanKeyNext === k ? { scanKeyNext: '' } : {}) }
            : { scanKeyNext: k, ...(s.scanKeySelect === k ? { scanKeySelect: '' } : {}) });
          setCapture(null);
        }} />
      )}
    </Section>
  );
}

/** "Press the switch now": records the next key press. */
function KeyCapture({ which, onKey, onClose }: { which: 'select' | 'next'; onKey: (k: string) => void; onClose: () => void }) {
  const cb = useRef(onKey);
  cb.current = onKey;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab' || e.repeat) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cb.current(e.key && e.key !== 'Unidentified' && e.key !== 'Dead' ? e.key : e.code);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  return (
    <Modal title={t(which === 'select' ? 'Set the select switch' : 'Set the next switch')} onClose={onClose}
      footer={<><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cancel')}</button></>}>
      <p className="center key-capture">{t('Press the switch (or key) now.')}</p>
    </Modal>
  );
}

/** Highlight colour and thickness for scanning, dwell and Find word. */
function HighlightSection() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const current = s.highlightColor ?? '';
  return (
    <Section title={t('Highlight')} intro={t('How the scanning and pointer highlight looks. A black and white edge keeps it visible on every button colour.')}>
      <div className="setting">
        <span className="setting-text"><b>{t('Colour')}</b></span>
        <div className="swatches" role="radiogroup" aria-label={t('Colour')}>
          {HIGHLIGHT_COLORS.map((c) => (
            <button key={c.value || 'theme'} role="radio" aria-checked={current === c.value} aria-label={t(c.name)} title={t(c.name)}
              className={`swatch ${current === c.value ? 'on' : ''} ${c.value ? '' : 'none'}`} style={c.value ? { background: c.value } : undefined}
              onClick={() => updateSettings({ highlightColor: c.value })}>{c.value ? '' : 'A'}</button>
          ))}
        </div>
      </div>
      <Slider label={t('Thickness')} value={ringWidth(s.highlightWidth)} min={2} max={14} onChange={(highlightWidth) => updateSettings({ highlightWidth })} format={(v) => `${v}px`} />
      <div className="highlight-preview" aria-hidden>
        {(['pronoun', 'verb', 'descriptor', 'noun'] as const).map((k, i) => (
          <span key={k} className={`cell ${i === 1 ? 'scan-hl-preview' : ''}`} style={{ background: WORD_COLORS[k][s.theme === 'light' ? 'light' : 'dark'] }}>{i === 1 ? t('Scanning') : t('Word')}</span>
        ))}
      </div>
    </Section>
  );
}

/** Fix how the voice says names and unusual words (applies to buttons, typing and phrases). */
function Pronunciations() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const map = s.pronunciations ?? {};
  const [word, setWord] = useState('');
  const [say, setSay] = useState('');
  const set = (m: Record<string, string>) => updateSettings({ pronunciations: m });
  return (
    <Section title={t('Pronunciations')} intro={t('If the voice says a name or word wrong, write how it should sound. For example, Siobhan → shi-vawn.')}>
      {Object.entries(map).map(([w, v]) => (
        <div key={w} className="pron-row">
          <b>{w}</b><span>→</span><span className="grow">{v}</span>
          <button className="btn small" onClick={() => speak(v, s)}>{t('Test')}</button>
          <button className="btn small danger-outline" onClick={() => { const m = { ...map }; delete m[w]; set(m); }}>{t('Remove')}</button>
        </div>
      ))}
      <div className="row">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t('Written word')} aria-label={t('Written word')} />
        <input value={say} onChange={(e) => setSay(e.target.value)} placeholder={t('Say it like')} aria-label={t('Say it like')} />
        <button className="btn" disabled={!say.trim()} onClick={() => speak(say, s)}>{t('Test')}</button>
        <button className="btn primary" disabled={!word.trim() || !say.trim()} onClick={() => { set({ ...map, [word.trim()]: say.trim() }); setWord(''); setSay(''); }}>{t('Add')}</button>
      </div>
    </Section>
  );
}

function PointerSection() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const [calibrating, setCalibrating] = useState(false);
  return (
    <Section title={t('Eye gaze & head pointer')} intro={t('Select by resting a pointer on a button (dwell). Use it with a mouse, a head-mouse or a hardware eye tracker, or let Caleb use the front camera. Camera images are processed on this device only and are never saved or sent. Touch always keeps working, so you or a support person can still tap.')}>
      <Choice label={t('Pointer')} value={s.pointer} onChange={(pointer) => updateSettings({ pointer })}
        options={[
          { value: 'off', label: t('Off') },
          { value: 'dwell', label: t('Dwell (mouse / eye tracker)') },
          { value: 'head', label: t('Head pointer (camera)') },
          { value: 'eyes', label: t('Eye gaze (camera, experimental)') },
        ]} />
      <Slider label={t('Dwell time')} hint={t('How long to rest on a button to select it.')} value={s.dwellMs} min={400} max={3000} step={100} onChange={(dwellMs) => updateSettings({ dwellMs })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
      {s.pointer !== 'off' && (
        <Toggle label={t('Rest button')} hint={t('A “Rest” button the person can dwell on to pause selecting, and dwell on again to carry on.')} checked={s.dwellRest !== false} onChange={(dwellRest) => updateSettings({ dwellRest })} />
      )}
      {(s.pointer === 'head' || s.pointer === 'eyes') && (
        <>
          {s.pointer === 'head' && <Slider label={t('Sensitivity')} hint={t('Higher = smaller head movements reach the edges.')} value={s.pointerSensitivity} min={1} max={10} onChange={(pointerSensitivity) => updateSettings({ pointerSensitivity })} />}
          <Slider label={t('Smoothing')} hint={t('Higher = steadier but slower pointer.')} value={s.pointerSmoothing} min={0} max={0.9} step={0.05} onChange={(pointerSmoothing) => updateSettings({ pointerSmoothing })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label={t('Long blink selects')} hint={t('Close both eyes for half a second to select what the pointer is on.')} checked={s.blinkSelect} onChange={(blinkSelect) => updateSettings({ blinkSelect })} />
        </>
      )}
      {s.pointer === 'eyes' && (
        <div className="row">
          <button className="btn primary" onClick={() => setCalibrating(true)}>{s.gazeCalibration ? t('Re-calibrate eyes') : t('Calibrate eyes')}</button>
          {!s.gazeCalibration && <span className="warn">{t('Calibrate for best results.')}</span>}
        </div>
      )}
      <p className="muted small">{t('Tip: the pointer pauses in Settings and in edit mode. With the head pointer, choose “Centre” (bottom left, by tapping or dwelling) and then look at the middle of the screen while it counts down.')}</p>
      {calibrating && <GazeCalibration onClose={() => setCalibrating(false)} />}
    </Section>
  );
}
