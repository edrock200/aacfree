import { useEffect, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section, Toggle } from './controls';
import { Modal } from '../../components/Modal';
import { pickFile, saveFile } from '../../lib/files';
import { createSyncFile, mergeData, openSyncFile, peekSyncFile, suggestPasscode, type MergeSummary, type SyncFile } from '../../lib/sync';
import { addSnapshot } from '../../lib/db';
import { backupFolderName, chooseBackupFolder, folderPickerSupported, lastAutoBackup, runAutoBackup, type AutoBackupStatus } from '../../lib/autobackup';
import { Capacitor } from '@capacitor/core';
import { formatDate } from '../../lib/util';
import { t } from '../../i18n';

export function AutoBackupSection() {
  const s = useProfile().settings;
  const data = useStore((st) => st.data);
  const { updateSettings, showToast } = useStore.getState();
  const [status, setStatus] = useState<AutoBackupStatus | undefined>();
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();
  useEffect(() => { lastAutoBackup().then(setStatus); backupFolderName().then(setFolder); }, []);

  const now = async () => {
    setBusy(true);
    try {
      const st = await runAutoBackup(data, { force: true, interactive: true });
      if (st) { setStatus(st); showToast(st.error ? t(st.error) : t('Backup saved')); }
    } finally { setBusy(false); }
  };

  if (!native && !folderPickerSupported()) {
    return (
      <Section title={t('Automatic backup')} intro={t('This browser can’t save files automatically. Use “Save backup file” regularly, or use the Android app or Chrome on a computer.')}><span /></Section>
    );
  }
  return (
    <Section title={t('Automatic backup')} intro={native
      ? t('Once a week Caleb saves a backup file to Documents/Caleb on this device. It stays there even if the app is removed. Point Google Drive or another backup app at that folder for an off-device copy.')
      : t('Once a week Caleb saves a backup file to a folder you choose (for example a Google Drive, Dropbox or OneDrive folder on this computer).')}>
      <Toggle label={t('Weekly backup file')} checked={s.autoBackup} onChange={(autoBackup) => updateSettings({ autoBackup })} />
      {!native && (
        <div className="row">
          <span className="grow">{folder ? `${t('Folder')}: ${folder}` : t('No folder chosen yet.')}</span>
          <button className="btn" onClick={async () => { const n = await chooseBackupFolder().catch(() => null); if (n) { setFolder(n); now(); } }}>{folder ? t('Change folder') : t('Choose folder')}</button>
        </div>
      )}
      <p className={status?.error ? 'warn' : 'muted small'}>
        {status?.t ? `${t('Last automatic backup')}: ${formatDate(status.t)} → ${status.where}` : t('No automatic backup yet.')}
        {status?.error ? ` — ${t(status.error)}` : ''}
      </p>
      <button className="btn" disabled={busy || (!native && !folder)} onClick={now}>{t('Back up now')}</button>
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
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const receive = async () => {
    setError('');
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { setIncoming(peekSyncFile(await f.text())); setRcode(''); } catch (e) { showToast((e as Error).message); }
  };

  const unlock = async () => {
    if (!incoming) return;
    setBusy(true); setError('');
    try {
      const d = await openSyncFile(incoming, rcode);
      const r = mergeData(useStore.getState().data, d);
      setPreview({ merged: r.data, summary: r.summary });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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
