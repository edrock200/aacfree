import { isIOSDevice } from '../../lib/platform';
import { useState } from 'react';
import { useStore, useProfile, useLock } from '../../store';
import { Section, Choice, Toggle } from './controls';
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
  const s = useLock(); // one lock for the whole app, whichever profile is active
  const settings = useProfile().settings;
  const { setLock, updateSettings, showToast } = useStore.getState();
  const [pin, setPin] = useState('');
  return (
    <>
      {s.pinNotice !== undefined && (
        <div className="nudge" role="status">
          <span>{t('Profiles had different PINs. AACFree now uses one PIN for the whole app: the one from {v0}.', { v0: s.pinNotice })}</span>
          <button className="btn small primary" onClick={() => setLock({ pinNotice: undefined })}>{t('OK')}</button>
        </div>
      )}
      <Section title={t('Settings lock')} intro={<>{t('Stops accidental changes. Talking is never locked — every word stays available.')} {t('The lock covers every profile on this device.')}</>}>
        <Choice<LockMethod> label={t('How to open Settings')} value={s.lock} onChange={(lock) => {
          if (lock === 'pin' && !s.pin) { showToast(t('Set a PIN below first')); return; }
          setLock({ lock });
        }}
          options={[
            { value: 'hold', label: t('Hold 2 seconds') },
            { value: 'math', label: t('Math question') },
            { value: 'pin', label: t('PIN') },
            { value: 'none', label: t('No lock') },
          ]} />
        <div className="field">
          <span>{s.pin ? t('Change PIN') : t('Set a PIN')} ({t('4–6 digits')})</span>
          <div className="row">
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" aria-label={t('PIN')} />
            <button className="btn" disabled={pin.length < 4} onClick={() => { setLock({ pin, lock: 'pin', pinNotice: undefined }); setPin(''); showToast(t('PIN saved')); }}>{t('Save PIN')}</button>
          </div>
        </div>
      </Section>
      <Section title={t('Privacy')} intro={t('AACFree has no accounts and never sends anything about the person. All pictures come with the app. If one is missing (for example on imported boards), AACFree can fetch it from arasaac.org, which then sees a request from this device. Searching for new symbols also uses arasaac.org.')}>
        <Toggle label={t('Download missing pictures from ARASAAC')} checked={settings.downloadSymbols !== false} onChange={(downloadSymbols) => updateSettings({ downloadSymbols })} />
      </Section>
      {isIOSDevice() ? (
        <Section title={t('Stay in the app (iPad and iPhone)')} intro={t('To stop the person leaving AACFree by accident, turn on Guided Access: Settings → Accessibility → Guided Access, and set a passcode. Then open AACFree and triple-click the side or Home button to start it. Triple-click again and enter the passcode to end it.')}>
          <span />
        </Section>
      ) : (
      <Section title={t('Stay in the app (Android)')} intro={t("To stop the person leaving AACFree by accident, turn on Android “App pinning”: Settings → Security → App pinning. Then open Recent apps, tap AACFree's icon and choose Pin. The Back button inside AACFree never closes the app.")}>
        <span />
      </Section>
      )}
    </>
  );
}
