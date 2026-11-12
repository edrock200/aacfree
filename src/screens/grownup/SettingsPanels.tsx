import { useEffect, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { listVoices, speak, type VoiceInfo } from '../../lib/tts';
import { Capacitor } from '@capacitor/core';
import { Choice, Section, Slider, Toggle } from './controls';
import { WORD_COLORS } from '../../lib/colors';
import { GazeCalibration } from '../../components/GazeCalibration';

export function SpeechPanel() {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings } = useStore.getState();
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [filter, setFilter] = useState('en');
  const native = Capacitor.isNativePlatform();

  useEffect(() => { listVoices().then(setVoices); }, []);
  const shown = voices.filter((v) => !filter || v.lang.toLowerCase().startsWith(filter));
  const current = native ? String(s.voiceIndex ?? '') : s.voiceURI ?? '';

  return (
    <>
      <Section title="Voice" intro="Pick a voice that sounds right to the person, and let them choose if they can. Voices come from the device; on Android you can install more in Settings → Text-to-speech.">
        <div className="setting">
          <span className="setting-text"><b>Language filter</b></span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All languages</option>
            {[...new Set(voices.map((v) => v.lang.slice(0, 2).toLowerCase()))].sort().map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="voice-list">
          <button className={`voice ${!current ? 'on' : ''}`} onClick={() => updateSettings({ voiceURI: undefined, voiceIndex: undefined, voiceName: undefined })}>
            <b>Device default</b><small>{s.lang}</small>
          </button>
          {shown.map((v) => (
            <button key={v.id} className={`voice ${current === v.id ? 'on' : ''}`} onClick={() => {
              const patch = native ? { voiceIndex: Number(v.id), voiceName: v.name, lang: v.lang } : { voiceURI: v.id, lang: v.lang };
              updateSettings(patch);
              speak(`Hi, I'm ${p.name || 'Caleb'}. This is my voice.`, { ...s, ...patch });
            }}>
              <b>{v.name}</b><small>{v.lang}{v.local ? '' : ' · online'}</small>
            </button>
          ))}
          {voices.length === 0 && <p className="muted">No voices found. On Android, install “Speech Services by Google” from the Play Store.</p>}
        </div>
        <Slider label="Speed" value={s.rate} min={0.5} max={1.8} step={0.05} onChange={(rate) => updateSettings({ rate })} format={(v) => `${v.toFixed(2)}×`} />
        <Slider label="Pitch" value={s.pitch} min={0.5} max={1.8} step={0.05} onChange={(pitch) => updateSettings({ pitch })} format={(v) => v.toFixed(2)} />
        <Slider label="Volume" value={s.volume} min={0.1} max={1} step={0.05} onChange={(volume) => updateSettings({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
        <button className="btn primary" onClick={() => speak('I want to go to the park, please.', s)}>Test voice</button>
      </Section>
      <Pronunciations />
      <Section title="Speaking">
        <Toggle label="Speak each word when tapped" hint="Turn off for silent sentence building." checked={s.speakOnTap} onChange={(speakOnTap) => updateSettings({ speakOnTap })} />
        <Toggle label="Say folder names when opened" checked={s.speakFolders} onChange={(speakFolders) => updateSettings({ speakFolders })} />
        <Toggle label="Clear message after speaking" checked={s.clearAfterSpeak} onChange={(clearAfterSpeak) => updateSettings({ clearAfterSpeak })} />
        <Toggle label="Go back to Home after picking a word in a folder" hint="Fewer taps for the next word." checked={s.returnHome} onChange={(returnHome) => updateSettings({ returnHome })} />
      </Section>
    </>
  );
}

export function DisplayPanel() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  return (
    <>
      <Section title="Look">
        <Choice label="Theme" value={s.theme} onChange={(theme) => updateSettings({ theme })}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'contrast', label: 'High contrast' }]} />
        <Choice label="Style" hint="“Clean” is calmer and more grown-up." value={s.style} onChange={(style) => updateSettings({ style })}
          options={[{ value: 'playful', label: 'Playful' }, { value: 'clean', label: 'Clean' }]} />
        <Choice label="Colour coding" hint="Modified Fitzgerald Key: colours by word type." value={s.colorMode} onChange={(colorMode) => updateSettings({ colorMode })}
          options={[{ value: 'fill', label: 'Filled' }, { value: 'border', label: 'Border only' }, { value: 'none', label: 'Off' }]} />
        <div className="legend">
          {(Object.keys(WORD_COLORS) as (keyof typeof WORD_COLORS)[]).filter((k) => k !== 'misc').map((k) => (
            <span key={k} style={{ background: WORD_COLORS[k].light }}>{WORD_COLORS[k].name}</span>
          ))}
        </div>
      </Section>
      <Section title="Buttons">
        <Toggle label="Show words on buttons" checked={s.showLabels} onChange={(showLabels) => updateSettings({ showLabels })} />
        <Toggle label="Words above pictures" checked={s.labelTop} onChange={(labelTop) => updateSettings({ labelTop })} />
        <Choice label="Letter case" value={s.textCase} onChange={(textCase) => updateSettings({ textCase })}
          options={[{ value: 'as-is', label: 'As written' }, { value: 'lower', label: 'lower' }, { value: 'upper', label: 'UPPER' }]} />
        <Slider label="Text size" value={s.fontScale} min={0.7} max={1.8} step={0.05} onChange={(fontScale) => updateSettings({ fontScale })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Space between buttons" value={s.gap} min={0} max={20} onChange={(gap) => updateSettings({ gap })} format={(v) => `${v}px`} />
        <Toggle label="Show pictures in the message bar" checked={s.showSymbolsInBar} onChange={(showSymbolsInBar) => updateSettings({ showSymbolsInBar })} />
      </Section>
      <Section title="Screen">
        <Toggle label="Quick bar (yes, no, stop, help…)" hint="Recommended: keeps protest and help words reachable everywhere." checked={s.showQuickBar} onChange={(showQuickBar) => updateSettings({ showQuickBar })} />
        <Toggle label="Keyboard button" checked={s.showKeyboardNav} onChange={(showKeyboardNav) => updateSettings({ showKeyboardNav })} />
        <Toggle label="Phrases button" checked={s.showPhrasesNav} onChange={(showPhrasesNav) => updateSettings({ showPhrasesNav })} />
        <Toggle label="Tools button" checked={s.showToolsNav} onChange={(showToolsNav) => updateSettings({ showToolsNav })} />
        <Toggle label="Reduce motion" checked={s.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} />
        <Toggle label="Keep screen awake" checked={s.keepAwake} onChange={(keepAwake) => updateSettings({ keepAwake })} />
        <Toggle label="Babble mode (show hidden words)" hint="Lets the person explore every word, including ones you've hidden for now." checked={s.babble} onChange={(babble) => updateSettings({ babble })} />
      </Section>
    </>
  );
}

export function AccessPanel() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  return (
    <>
      <Section title="Touch" intro="Adjust these if the person has trouble with accidental taps or holding a finger still.">
        <Slider label="Hold to select" hint="Finger must stay on a button this long. 0 = off." value={s.holdMs} min={0} max={2000} step={100} onChange={(holdMs) => updateSettings({ holdMs })} format={(v) => (v ? `${(v / 1000).toFixed(1)} s` : 'Off')} />
        <Slider label="Ignore repeated taps" hint="After a selection, ignore taps for this long." value={s.debounceMs} min={0} max={2000} step={100} onChange={(debounceMs) => updateSettings({ debounceMs })} format={(v) => (v ? `${(v / 1000).toFixed(1)} s` : 'Off')} />
        <Toggle label="Select on touch (instead of release)" hint="Fastest for confident users. Long-press for word forms is off with this." checked={s.pressOnDown} onChange={(pressOnDown) => updateSettings({ pressOnDown })} />
      </Section>
      <Section title="Feedback">
        <Toggle label="Click sound" checked={s.clickSound} onChange={(clickSound) => updateSettings({ clickSound })} />
        <Toggle label="Vibrate" checked={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
      </Section>
      <PointerSection />
      <Section title="Switch scanning" intro="For people who use a switch (or two). Bluetooth switches that act like a keyboard work: Space / Enter. Tapping the screen also works as a switch.">
        <Toggle label="Turn on scanning" checked={s.scanning} onChange={(scanning) => updateSettings({ scanning })} />
        <Choice label="Mode" value={s.scanMode} onChange={(scanMode) => updateSettings({ scanMode })}
          options={[{ value: 'auto', label: '1 switch (auto)' }, { value: 'step', label: '2 switches (step)' }]} />
        <Choice label="Pattern" value={s.scanPattern} onChange={(scanPattern) => updateSettings({ scanPattern })}
          options={[{ value: 'row-col', label: 'Rows, then buttons' }, { value: 'linear', label: 'One by one' }]} />
        <Slider label="Scan speed" value={s.scanMs} min={500} max={4000} step={100} onChange={(scanMs) => updateSettings({ scanMs })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
        <Toggle label="Speak items while scanning (auditory scanning)" checked={s.scanSpeak} onChange={(scanSpeak) => updateSettings({ scanSpeak })} />
        <p className="muted small">2-switch mode: Space = next, Enter = select. On a touchscreen: tap = next, long tap = select. To leave scanning, hold the 🔒 button.</p>
      </Section>
    </>
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
    <Section title="Pronunciations" intro="If the voice says a name or word wrong, write how it should sound. For example, Siobhan → shi-vawn.">
      {Object.entries(map).map(([w, v]) => (
        <div key={w} className="pron-row">
          <b>{w}</b><span>→</span><span className="grow">{v}</span>
          <button className="btn small" onClick={() => speak(v, s)}>Test</button>
          <button className="btn small danger-outline" onClick={() => { const m = { ...map }; delete m[w]; set(m); }}>Remove</button>
        </div>
      ))}
      <div className="row">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Written word" aria-label="Written word" />
        <input value={say} onChange={(e) => setSay(e.target.value)} placeholder="Say it like" aria-label="Say it like" />
        <button className="btn" disabled={!say.trim()} onClick={() => speak(say, s)}>Test</button>
        <button className="btn primary" disabled={!word.trim() || !say.trim()} onClick={() => { set({ ...map, [word.trim()]: say.trim() }); setWord(''); setSay(''); }}>Add</button>
      </div>
    </Section>
  );
}

function PointerSection() {
  const s = useProfile().settings;
  const { updateSettings } = useStore.getState();
  const [calibrating, setCalibrating] = useState(false);
  return (
    <Section title="Eye gaze & head pointer" intro="Select by resting a pointer on a button (dwell). Use it with a mouse, a head-mouse or a hardware eye tracker, or let Caleb use the front camera. Camera images are processed on this device only and are never saved or sent. Touch always keeps working, so a grown-up can still tap.">
      <Choice label="Pointer" value={s.pointer} onChange={(pointer) => updateSettings({ pointer })}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'dwell', label: 'Dwell (mouse / eye tracker)' },
          { value: 'head', label: 'Head pointer (camera)' },
          { value: 'eyes', label: 'Eye gaze (camera, experimental)' },
        ]} />
      <Slider label="Dwell time" hint="How long to rest on a button to select it." value={s.dwellMs} min={400} max={3000} step={100} onChange={(dwellMs) => updateSettings({ dwellMs })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
      {(s.pointer === 'head' || s.pointer === 'eyes') && (
        <>
          {s.pointer === 'head' && <Slider label="Sensitivity" hint="Higher = smaller head movements reach the edges." value={s.pointerSensitivity} min={1} max={10} onChange={(pointerSensitivity) => updateSettings({ pointerSensitivity })} />}
          <Slider label="Smoothing" hint="Higher = steadier but slower pointer." value={s.pointerSmoothing} min={0} max={0.9} step={0.05} onChange={(pointerSmoothing) => updateSettings({ pointerSmoothing })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Long blink selects" hint="Close both eyes for half a second to select what the pointer is on." checked={s.blinkSelect} onChange={(blinkSelect) => updateSettings({ blinkSelect })} />
        </>
      )}
      {s.pointer === 'eyes' && (
        <div className="row">
          <button className="btn primary" onClick={() => setCalibrating(true)}>{s.gazeCalibration ? 'Re-calibrate eyes' : 'Calibrate eyes'}</button>
          {!s.gazeCalibration && <span className="warn">Calibrate for best results.</span>}
        </div>
      )}
      <p className="muted small">Tip: the pointer pauses in Grown-ups and in edit mode. With the head pointer, tap “Centre” (bottom left) while looking at the middle of the screen.</p>
      {calibrating && <GazeCalibration onClose={() => setCalibrating(false)} />}
    </Section>
  );
}
