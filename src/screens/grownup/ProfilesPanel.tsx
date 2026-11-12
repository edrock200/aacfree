import { useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section, Choice } from './controls';
import { Modal } from '../../components/Modal';
import { LAYOUTS } from './VocabPanel';
import type { LayoutId, LockMethod } from '../../types';

export function ProfilesPanel() {
  const data = useStore((st) => st.data);
  const p = useProfile();
  const { switchProfile, addProfile, deleteProfile, updateProfile, showToast } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<LayoutId>('medium');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <>
      <Section title="This person" intro="Each profile has its own boards, phrases, voice and settings — handy for siblings, or for a school device.">
        <label className="field"><span>Name</span>
          <input value={p.name} onChange={(e) => updateProfile((pp) => { pp.name = e.target.value; })} placeholder="Name" />
        </label>
      </Section>
      <Section title="Profiles">
        <ul className="profile-list">
          {data.profiles.map((x) => (
            <li key={x.id} className={x.id === p.id ? 'on' : ''}>
              <span className="avatar">{(x.name || '?')[0]?.toUpperCase()}</span>
              <b className="grow">{x.name || 'Unnamed'}</b>
              {x.id === p.id ? <span className="chip">Active</span> : <button className="btn small" onClick={() => { switchProfile(x.id); showToast(`Switched to ${x.name || 'profile'}`); }}>Switch</button>}
              {data.profiles.length > 1 && <button className="btn small danger-outline" onClick={() => setConfirmDel(x.id)}>Delete</button>}
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => setAdding(true)}>+ Add profile</button>
      </Section>
      {adding && (
        <Modal title="New profile" onClose={() => setAdding(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={() => { addProfile(name.trim(), layout); setAdding(false); setName(''); }}>Create</button></>}>
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
          <Choice label="Layout" value={layout} onChange={setLayout} options={LAYOUTS.map((l) => ({ value: l.id, label: l.name }))} />
        </Modal>
      )}
      {confirmDel && (
        <Modal title="Delete profile?" onClose={() => setConfirmDel(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { deleteProfile(confirmDel); setConfirmDel(null); }}>Delete</button></>}>
          <p>This removes all of <b>{data.profiles.find((x) => x.id === confirmDel)?.name || 'this profile'}</b>'s boards and phrases. A snapshot is saved first (Backup → Automatic snapshots).</p>
        </Modal>
      )}
    </>
  );
}

export function SecurityPanel() {
  const s = useProfile().settings;
  const { updateSettings, showToast } = useStore.getState();
  const [pin, setPin] = useState('');
  return (
    <>
      <Section title="Grown-up lock" intro="Stops accidental changes. Talking is never locked — every word stays available.">
        <Choice<LockMethod> label="How to open Grown-ups" value={s.lock} onChange={(lock) => {
          if (lock === 'pin' && !s.pin) { showToast('Set a PIN below first'); return; }
          updateSettings({ lock });
        }}
          options={[
            { value: 'hold', label: 'Hold 2 seconds' },
            { value: 'math', label: 'Math question' },
            { value: 'pin', label: 'PIN' },
            { value: 'none', label: 'No lock' },
          ]} />
        <div className="field">
          <span>{s.pin ? 'Change PIN' : 'Set a PIN'} (4–6 digits)</span>
          <div className="row">
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            <button className="btn" disabled={pin.length < 4} onClick={() => { updateSettings({ pin, lock: 'pin' }); setPin(''); showToast('PIN saved'); }}>Save PIN</button>
          </div>
        </div>
      </Section>
      <Section title="Stay in the app (Android)" intro="To stop the person leaving Caleb by accident, turn on Android “App pinning”: Settings → Security → App pinning. Then open Recent apps, tap Caleb's icon and choose Pin. The Back button inside Caleb never closes the app.">
        <span />
      </Section>
    </>
  );
}
