import { useEffect, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Choice, Section, Slider, Toggle } from './controls';
import { Modal } from '../../components/Modal';
import { pickFile, saveFile } from '../../lib/files';
import { createSyncFile, mergeData, openSyncFile, peekSyncFile, suggestPasscode, type MergeSummary, type SyncFile } from '../../lib/sync';
import { addSnapshot } from '../../lib/db';
import {
  backupFolderName, chooseBackupFolder, chooseCloudFile, folderPickerSupported, forgetCloudFile, getBackupPasscode, getPrefs,
  lastAutoBackup, listSavedBackups, openCloudBackup, runAutoBackup, setBackupPasscode, setPrefs,
  type AutoBackupStatus, type BackupPrefs, type SavedBackup,
} from '../../lib/autobackup';
import { Capacitor } from '@capacitor/core';
import { formatDate } from '../../lib/util';
import { t } from '../../i18n';

export function AutoBackupSection({ onRestore }: { onRestore: (text: string, name: string) => void }) {
  const data = useStore((st) => st.data);
  const { showToast } = useStore.getState();
  const [prefs, setP] = useState<BackupPrefs | null>(null);
  const [status, setStatus] = useState<AutoBackupStatus | undefined>();
  const [folder, setFolder] = useState<string | null>(null);
  const [hasPass, setHasPass] = useState(false);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedBackup[] | null>(null);
  const native = Capacitor.isNativePlatform();
  useEffect(() => {
    getPrefs().then(setP);
    lastAutoBackup().then(setStatus);
    backupFolderName().then(setFolder);
    getBackupPasscode().then((x) => setHasPass(!!x));
  }, []);
  if (!prefs) return null;
  const update = async (patch: Partial<BackupPrefs>) => setP(await setPrefs(patch));

  const now = async () => {
    setBusy(true);
    try {
      const st = await runAutoBackup(data, { force: true, interactive: true });
      if (st) { setStatus(st); showToast(st.error ? t(st.error) : t('Backup saved')); }
      else showToast(t('Choose where to save backups first.'));
    } finally { setBusy(false); }
  };

  const canAuto = native || folderPickerSupported();
  return (
    <Section title={t('Automatic backup')} intro={native
      ? t('Caleb saves backup files to Documents/Caleb on this device. They stay there even if the app is removed. You can also keep a copy in Google Drive, OneDrive, Dropbox or on an SD card.')
      : canAuto
        ? t('Caleb saves backup files to a folder you choose (for example a Google Drive, Dropbox or OneDrive folder on this computer).')
        : t('This browser can’t save files automatically. Use “Save backup file” regularly, or use the Android app or Chrome on a computer.')}>
      {canAuto && (
        <>
          <Toggle label={t('Automatic backups')} checked={prefs.enabled} onChange={(enabled) => update({ enabled })} />
          <Choice label={t('How often')} value={prefs.frequency} onChange={(frequency) => update({ frequency })}
            options={[{ value: 'daily', label: t('Daily') }, { value: 'weekly', label: t('Weekly') }, { value: 'monthly', label: t('Monthly') }]} />
          <Slider label={t('Copies to keep')} hint={t('Older copies are deleted automatically.')} value={prefs.keep} min={1} max={12} onChange={(keep) => update({ keep })} />
          <div className="setting">
            <span className="setting-text"><b>{t('Where')}</b>
              <small>{native ? 'Documents/Caleb' : folder ? `${t('Folder')}: ${folder}` : t('No folder chosen yet.')}</small>
              {native && <small>{prefs.cloudName ? `${t('Cloud copy')}: ${prefs.cloudName}` : t('No cloud copy yet.')}</small>}
            </span>
            {!native && <button className="btn" onClick={async () => { const n = await chooseBackupFolder().catch(() => null); if (n) { setFolder(n); now(); } }}>{folder ? t('Change folder') : t('Choose folder')}</button>}
            {native && (
              <>
                <button className="btn" onClick={async () => { const n = await chooseCloudFile().catch(() => null); if (n) { getPrefs().then(setP); now(); } }}>{prefs.cloudName ? t('Change cloud file') : t('Add a cloud copy…')}</button>
                {prefs.cloudName && <button className="btn small" onClick={async () => { await forgetCloudFile(); getPrefs().then(setP); }}>{t('Remove')}</button>}
              </>
            )}
          </div>
        </>
      )}
      <Toggle label={t('Include photos and recorded voices')} hint={t('Turn off for much smaller files.')} checked={prefs.includeMedia} onChange={(includeMedia) => update({ includeMedia })} />
      <Toggle label={t('Include message history and learned words')} hint={t('Turn off for more privacy.')} checked={prefs.includeHistory} onChange={(includeHistory) => update({ includeHistory })} />
      <Toggle label={t('Lock backups with a passcode')} hint={t('Backup files are encrypted. You need the passcode to restore them, so write it down somewhere safe.')} checked={prefs.encrypt} onChange={(encrypt) => update({ encrypt })} />
      {prefs.encrypt && (
        <div className="row">
          <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder={hasPass ? t('Passcode is set — type to change') : t('Backup passcode (6+ characters)')} autoComplete="off" spellCheck={false} aria-label={t('Backup passcode')} />
          <button className="btn" disabled={pass.length < 6} onClick={async () => { await setBackupPasscode(pass); setHasPass(true); setPass(''); showToast(t('Passcode saved on this device')); }}>{t('Save passcode')}</button>
          {!hasPass && <span className="warn">{t('Set a backup passcode first.')}</span>}
        </div>
      )}
      {canAuto && (
        <p className={status?.error ? 'warn' : 'muted small'}>
          {status?.t ? `${t('Last automatic backup')}: ${formatDate(status.t)} → ${status.where}` : t('No automatic backup yet.')}
          {status?.error ? ` — ${t(status.error)}` : ''}
        </p>
      )}
      <div className="row">
        {canAuto && <button className="btn primary" disabled={busy} onClick={now}>{t('Back up now')}</button>}
        {canAuto && <button className="btn" onClick={async () => setSaved(await listSavedBackups())}>{t('Restore an automatic backup…')}</button>}
        {native && <button className="btn" onClick={async () => { const text = await openCloudBackup().catch(() => null); if (text) onRestore(text, t('Backup file')); }}>{t('Open a backup from Drive or another app…')}</button>}
      </div>
      {saved && (
        <Modal title={t('Restore an automatic backup')} onClose={() => setSaved(null)}>
          <ul className="snap-list">
            {saved.map((b) => (
              <li key={b.source + b.name}>
                <span><b>{b.t ? formatDate(b.t) : b.name}</b><small>{b.source === 'cloud' ? t('Cloud copy') : b.name}</small></span>
                <button className="btn small" onClick={async () => { const text = await b.read(); setSaved(null); onRestore(text, b.name); }}>{t('Restore')}</button>
              </li>
            ))}
            {saved.length === 0 && <li className="muted">{t('No automatic backups found.')}</li>}
          </ul>
        </Modal>
      )}
    </Section>
  );
}

export function SyncSection() {
  const data = useStore((st) => st.data);
  const p = useProfile();
  const { replaceData, showToast } = useStore.getState();
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [chosen, setChosen] = useState<string[]>([p.id]);
  const [incoming, setIncoming] = useState<SyncFile | null>(null);
  const [rcode, setRcode] = useState('');
  const [preview, setPreview] = useState<{ merged: ReturnType<typeof mergeData>['data']; summary: MergeSummary } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const blob = await createSyncFile(data, chosen, code);
      const stamp = new Date().toISOString().slice(0, 10);
      showToast(await saveFile(`caleb-sync-${stamp}.calebsync.json`, blob));
      setSending(false);
    } catch (e) { setError(t((e as Error).message)); } finally { setBusy(false); }
  };

  const receive = async () => {
    setError('');
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { setIncoming(peekSyncFile(await f.text())); setRcode(''); } catch (e) { showToast(t((e as Error).message)); }
  };

  const unlock = async () => {
    if (!incoming) return;
    setBusy(true); setError('');
    try {
      const d = await openSyncFile(incoming, rcode);
      const r = mergeData(useStore.getState().data, d);
      setPreview({ merged: r.data, summary: r.summary });
    } catch (e) { setError(t((e as Error).message)); } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview) return;
    await addSnapshot(useStore.getState().data, 'Before syncing from another device');
    await replaceData(preview.merged, 'Before syncing from another device');
    showToast(t('Synced'));
    setPreview(null); setIncoming(null);
  };

  return (
    <Section title={t('Sync between devices (encrypted)')} intro={t('Keep a parent’s phone and the user’s tablet in step without any account or server. “Send” makes a file locked with a passcode. Move it any way you like (share, email, cloud drive), then “Receive” it on the other device. The newest version of each profile wins, and symbol libraries are combined.')}>
      <div className="row">
        <button className="btn primary" onClick={() => { setSending(true); setCode(suggestPasscode()); setError(''); }}>{t('Send to another device…')}</button>
        <button className="btn" onClick={receive}>{t('Receive from another device…')}</button>
      </div>
      {sending && (
        <Modal title={t('Send to another device')} onClose={() => setSending(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setSending(false)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={busy || code.length < 6 || !chosen.length} onClick={send}>{busy ? t('Locking…') : t('Create sync file')}</button></>}>
          <div className="field"><span>{t('Profiles to send')}</span>
            {data.profiles.map((x) => (
              <label key={x.id} className="check"><input type="checkbox" checked={chosen.includes(x.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, x.id] : chosen.filter((y) => y !== x.id))} /><span>{x.name || t('Unnamed')}</span></label>
            ))}
          </div>
          <label className="field"><span>{t('Passcode (you’ll type it on the other device)')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <p className="muted small">{t('Write the passcode down or tell it to the other person. Don’t send it together with the file.')}</p>
          {error && <p className="error">{error}</p>}
        </Modal>
      )}
      {incoming && !preview && (
        <Modal title={t('Receive from another device')} onClose={() => setIncoming(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setIncoming(null)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={busy || !rcode} onClick={unlock}>{busy ? t('Unlocking…') : t('Unlock')}</button></>}>
          <p>{t('This file contains')}: <b>{incoming.profiles.join(', ')}</b> ({formatDate(Date.parse(incoming.createdAt))}).</p>
          <label className="field"><span>{t('Passcode')}</span><input autoFocus value={rcode} onChange={(e) => setRcode(e.target.value)} autoComplete="off" spellCheck={false} /></label>
          {error && <p className="error">{error}</p>}
        </Modal>
      )}
      {preview && (
        <Modal title={t('Ready to sync')} onClose={() => setPreview(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setPreview(null)}>{t('Cancel')}</button>
            <button className="btn primary" onClick={apply}>{t('Sync now')}</button></>}>
          <ul>
            {preview.summary.added.length > 0 && <li>{t('New profiles')}: {preview.summary.added.join(', ')}</li>}
            {preview.summary.updated.length > 0 && <li>{t('Updated (newer on the other device)')}: {preview.summary.updated.join(', ')}</li>}
            {preview.summary.kept.length > 0 && <li>{t('Kept (this device is newer)')}: {preview.summary.kept.join(', ')}</li>}
          </ul>
          <p className="muted small">{t('A snapshot is saved first, so you can undo this from Automatic snapshots.')}</p>
        </Modal>
      )}
    </Section>
  );
}
