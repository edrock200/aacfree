import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { LAYOUTS, LayoutThumb, STARTER_WORDS } from './grownup/VocabPanel';
import { listVoices, speak, type VoiceInfo } from '../lib/tts';
import { DEFAULT_SETTINGS } from '../data/defaults';
import { Capacitor } from '@capacitor/core';
import type { LayoutId, Settings } from '../types';

/** First-run setup: name, layout, voice, lock. Every step can be skipped. */
export function Onboarding() {
  const { completeOnboarding } = useStore.getState();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<LayoutId>(() => (Math.min(window.innerWidth, window.innerHeight) < 600 ? 'big' : 'medium'));
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [patch, setPatch] = useState<Partial<Settings>>({});
  const [style, setStyle] = useState<'playful' | 'clean'>('playful');
  const [starter, setStarter] = useState(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => { listVoices().then((v) => setVoices(v.filter((x) => x.lang.toLowerCase().startsWith('en')).slice(0, 12))); }, []);

  const finish = () => {
    completeOnboarding(name.trim(), layout, { ...patch, style });
    if (starter && layout !== 'big') {
      useStore.getState().updateProfile((pp) => {
        pp.boards[pp.rootId].cells.forEach((c) => { if (c && !c.link && !c.action && !STARTER_WORDS.includes(c.label.toLowerCase())) c.hidden = true; });
      });
    }
  };

  return (
    <div className="onboarding">
      <div className="ob-card">
        <div className="ob-dots">{[0, 1, 2, 3].map((i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        {step === 0 && (
          <>
            <img className="ob-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
            <h1>Welcome to Caleb</h1>
            <p>A free communication app (AAC) for autistic people and the people who love them. No ads, no accounts, and it works offline. Everything stays on this device.</p>
            <label className="field"><span>Who will use Caleb? <small>(optional)</small></span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </label>
            <div className="ob-actions">
              <button className="btn" onClick={finish}>Skip setup</button>
              <button className="btn primary" onClick={() => setStep(1)}>Next</button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Choose a starting layout</h2>
            <p className="muted">All layouts keep core words in fixed places so they can be learned by muscle memory. You can hide words now and reveal them later, without moving anything.</p>
            <div className="layout-cards">
              {LAYOUTS.map((l) => (
                <button key={l.id} className={`layout-card ${layout === l.id ? 'on' : ''}`} onClick={() => setLayout(l.id)}>
                  <LayoutThumb id={l.id} />
                  <b>{l.name}</b>
                  <small>{l.desc}</small>
                </button>
              ))}
            </div>
            {layout !== 'big' && (
              <label className="check">
                <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
                <span><b>Start with fewer words</b> <small>(recommended for beginners: shows key words first, and the rest keep their places for later)</small></span>
              </label>
            )}
            <div className="seg">
              <button className={style === 'playful' ? 'on' : ''} onClick={() => setStyle('playful')}>Playful look</button>
              <button className={style === 'clean' ? 'on' : ''} onClick={() => setStyle('clean')}>Clean / grown-up look</button>
            </div>
            <div className="ob-actions">
              <button className="btn" onClick={() => setStep(0)}>Back</button>
              <button className="btn primary" onClick={() => setStep(2)}>Next</button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Pick a voice</h2>
            <p className="muted">Tap to hear each voice. If possible, let {name || 'the person'} choose. You can change this later.</p>
            <div className="voice-list">
              <button className={`voice ${patch.voiceURI === undefined && patch.voiceIndex === undefined ? 'on' : ''}`} onClick={() => { setPatch({ ...patch, voiceURI: undefined, voiceIndex: undefined }); speak('Hello! This is my voice.', DEFAULT_SETTINGS); }}>
                <b>Device default</b>
              </button>
              {voices.map((v) => {
                const vp = native ? { voiceIndex: Number(v.id), lang: v.lang } : { voiceURI: v.id, lang: v.lang };
                const on = native ? patch.voiceIndex === Number(v.id) : patch.voiceURI === v.id;
                return (
                  <button key={v.id} className={`voice ${on ? 'on' : ''}`} onClick={() => { setPatch({ ...patch, ...vp }); speak('Hello! This is my voice.', { ...DEFAULT_SETTINGS, ...vp }); }}>
                    <b>{v.name}</b><small>{v.lang}</small>
                  </button>
                );
              })}
            </div>
            <div className="ob-actions">
              <button className="btn" onClick={() => setStep(1)}>Back</button>
              <button className="btn primary" onClick={() => setStep(3)}>Next</button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Grown-up area</h2>
            <p>Editing and settings are behind the <b>Grown-ups</b> button (bottom right). By default you <b>hold it for 2 seconds</b>, which is easy for adults and hard to do by accident. You can switch to a PIN later.</p>
            <ul className="ob-tips">
              <li>🗣️ <b>Model it:</b> tap words yourself as you talk. That's how AAC is learned.</li>
              <li>🔒 <b>Talking is never locked.</b> “No”, “stop”, “help” and “break” are always in the top bar.</li>
              <li>💾 <b>Back up</b> from Grown-ups → Backup. Caleb also keeps automatic snapshots.</li>
            </ul>
            <div className="ob-actions">
              <button className="btn" onClick={() => setStep(2)}>Back</button>
              <button className="btn primary big" onClick={finish}>Start talking</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
