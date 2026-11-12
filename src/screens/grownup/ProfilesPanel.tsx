import { useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section, Choice } from './controls';
import { Modal } from '../../components/Modal';
import { LAYOUTS } from './VocabPanel';
import type { LayoutId, LockMethod } from '../../types';
import { t } from '../../i18n';

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
      <Section title={t('This person')} intro={t('Each profile has its own boards, phrases, voice and settings — handy for siblings, or for a school device.')}>
        <label className="field"><span>{t('Name')}</span>
          <input value={p.name} onChange={(e) => updateProfile((pp) => { pp.name = e.target.value; })} placeholder={t('Name')} />
        </label>
      </Section>
      <Section title={t('Profiles')}>
        <ul className="profile-list">
          {data.profiles.map((x) => (
            <li key={x.id} className={x.id === p.id ? 'on' : ''}>
              <span className="avatar">{(x.name || '?')[0]?.toUpperCase()}</span>
              <b className="grow">{x.name || 'Unnamed'}</b>
              {x.id === p.id ? <span className="chip">{t('Active')}</span> : <button className="btn small" onClick={() => { switchProfile(x.id); showToast(t('Switched to {v0}', { v0: x.name || 'profile' })); }}>{t('Switch')}</button>}
              {data.profiles.length > 1 && <button className="btn small danger-outline" onClick={() => setConfirmDel(x.id)}>{t('Delete')}</button>}
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => setAdding(true)}>{t('+ Add profile')}</button>
      </Section>
      {adding && (
        <Modal title={t('New profile')} onClose={() => setAdding(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setAdding(false)}>{t('Cancel')}</button>
            <button className="btn primary" onClick={() => { addProfile(name.trim(), layout); setAdding(false); setName(''); }}>{t('Create')}</button></>}>
          <label className="field"><span>{t('Name')}</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
          <Choice label={t('Layout')} value={layout} onChange={setLayout} options={LAYOUTS.map((l) => ({ value: l.id, label: l.name }))} />
        </Modal>
      )}
      {confirmDel && (
        <Modal title={t('Delete profile?')} onClose={() => setConfirmDel(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirmDel(null)}>{t('Cancel')}</button>
            <button className="btn danger" onClick={() => { deleteProfile(confirmDel); setConfirmDel(null); }}>{t('Delete')}</button></>}>
          <p>{t("This removes all of {name}'s boards and phrases. A snapshot is saved first (Backup → Automatic snapshots).", { name: data.profiles.find((x) => x.id === confirmDel)?.name || t('this profile') })}</p>
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
      <Section title={t('Grown-up lock')} intro={t('Stops accidental changes. Talking is never locked — every word stays available.')}>
        <Choice<LockMethod> label={t('How to open Grown-ups')} value={s.lock} onChange={(lock) => {
          if (lock === 'pin' && !s.pin) { showToast(t('Set a PIN below first')); return; }
          updateSettings({ lock });
        }}
          options={[
            { value: 'hold', label: t('Hold 2 seconds') },
            { value: 'math', label: t('Math question') },
            { value: 'pin', label: t('PIN') },
            { value: 'none', label: t('No lock') },
          ]} />
        <div className="field">
          <span>{s.pin ? 'Change PIN' : 'Set a PIN'} (4–6 digits)</span>
          <div className="row">
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            <button className="btn" disabled={pin.length < 4} onClick={() => { updateSettings({ pin, lock: 'pin' }); setPin(''); showToast(t('PIN saved')); }}>{t('Save PIN')}</button>
          </div>
        </div>
      </Section>
      <Section title={t('Stay in the app (Android)')} intro={t("To stop the person leaving Caleb by accident, turn on Android “App pinning”: Settings → Security → App pinning. Then open Recent apps, tap Caleb's icon and choose Pin. The Back button inside Caleb never closes the app.")}>
        <span />
      </Section>
    </>
  );
}
