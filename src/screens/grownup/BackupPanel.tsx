import { useEffect, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section } from './controls';
import { backupFilename, createBackup, readBackup } from '../../lib/backup';
import { addSnapshot, getSnapshot, listSnapshots, type Snapshot } from '../../lib/db';
import { pickFile, saveFile } from '../../lib/files';
import { exportOBZ, importOBF } from '../../lib/obf';
import { buildProfile } from '../../data/defaults';
import { formatDate } from '../../lib/util';
import { Modal } from '../../components/Modal';
import type { AppData } from '../../types';
import { AutoBackupSection, SyncSection } from './SyncSection';
import { t } from '../../i18n';

export function BackupPanel() {
  const p = useProfile();
  const data = useStore((st) => st.data);
  const { replaceData, showToast } = useStore.getState();
  const [snaps, setSnaps] = useState<Omit<Snapshot, 'data'>[]>([]);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<Omit<Snapshot, 'data'> | null>(null);
  const [pendingFile, setPendingFile] = useState<{ data: AppData; name: string } | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage != null && e.quota && setUsage({ used: e.usage, quota: e.quota })).catch(() => {});
  }, []);

  const refresh = () => listSnapshots().then(setSnaps);
  useEffect(() => { refresh(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { showToast(t((e as Error).message || 'Something went wrong')); } finally { setBusy(false); }
  };

  const exportAll = () => run(async () => {
    const blob = await createBackup(data);
    showToast(await saveFile(backupFilename(p.name), blob));
    localStorage.setItem('caleb:lastExport', String(Date.now()));
  });

  const importAll = () => run(async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    const d = await readBackup(await f.text());
    setPendingFile({ data: d, name: f.name });
  });

  const exportObz = () => run(async () => {
    const blob = await exportOBZ(p);
    showToast(await saveFile(`${(p.name || 'caleb').toLowerCase().replace(/\W+/g, '-')}-boards.obz`, blob));
  });

  const importObz = () => run(async () => {
    const f = await pickFile('.obz,.obf,application/zip,application/json');
    if (!f) return;
    const { boards, rootId, name } = await importOBF(f);
    const np = buildProfile(name, 'medium');
    np.boards = boards;
    np.rootId = rootId;
    np.name = name;
    np.layout = 'medium';
    await replaceData({ ...data, profiles: [...data.profiles, np], activeProfileId: np.id }, 'Before importing boards');
    showToast(t('Imported “{v0}” as a new profile', { v0: name }));
  });

  const snapshotNow = () => run(async () => {
    await addSnapshot(data, 'Manual snapshot');
    showToast(t('Snapshot saved'));
    refresh();
  });

  const doRestore = (id: number) => run(async () => {
    const s = await getSnapshot(id);
    if (!s) return;
    await replaceData(s.data, 'Before restoring a snapshot');
    setRestore(null);
    showToast(t('Restored'));
    refresh();
  });

  const last = Number(localStorage.getItem('caleb:lastExport') ?? 0);

  return (
    <>
      <Section title={t('Backup file')} intro={t('Saves everything — all profiles, boards, photos, recordings, phrases and settings — in one file. Keep a copy somewhere safe (cloud drive, email to yourself). Use it to move to a new device too.')}>
        <p className={last && Date.now() - last < 30 * 86400000 ? 'muted' : 'warn'}>
          {last ? `Last backup file: ${formatDate(last)}` : 'You have not saved a backup file yet.'}
        </p>
        {usage && <p className="muted small">Storage used on this device: {(usage.used / 1048576).toFixed(1)} MB of {(usage.quota / 1073741824).toFixed(1)} GB available.</p>}
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={exportAll}>{t('Save backup file')}</button>
          <button className="btn" disabled={busy} onClick={importAll}>{t('Restore from file…')}</button>
        </div>
      </Section>
      <AutoBackupSection />
      <SyncSection />
      <Section title={t('Automatic snapshots')} intro={t('Caleb keeps the last 15 versions on this device: one per day, plus one before every restore, layout change or import.')}>
        <button className="btn small" disabled={busy} onClick={snapshotNow}>{t('Take snapshot now')}</button>
        <ul className="snap-list">
          {snaps.map((s) => (
            <li key={s.id}>
              <span><b>{formatDate(s.t)}</b><small>{s.reason}</small></span>
              <button className="btn small" onClick={() => setRestore(s)}>{t('Restore')}</button>
            </li>
          ))}
          {snaps.length === 0 && <li className="muted">{t('No snapshots yet.')}</li>}
        </ul>
      </Section>
      <Section title={t('Share boards (Open Board Format)')} intro={t('Export boards as .obz to use in other AAC apps (CoughDrop, Cboard, etc.), or import .obz/.obf boards made elsewhere. Imports become a new profile so nothing is overwritten.')}>
        <div className="row">
          <button className="btn" disabled={busy} onClick={exportObz}>Export boards (.obz)</button>
          <button className="btn" disabled={busy} onClick={importObz}>{t('Import boards…')}</button>
        </div>
      </Section>
      {pendingFile && (
        <Modal title={t('Restore this backup?')} onClose={() => setPendingFile(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setPendingFile(null)}>{t('Cancel')}</button>
            <button className="btn primary" onClick={() => run(async () => {
              await replaceData(pendingFile.data, 'Before importing a backup');
              setPendingFile(null);
              showToast(t('Backup restored'));
              refresh();
            })}>{t('Replace with backup')}</button></>}>
          <p><b>{pendingFile.name}</b> contains {pendingFile.data.profiles.length} profile(s): {pendingFile.data.profiles.map((x) => x.name || 'Unnamed').join(', ')}.</p>
          <p>{t('Everything on this device is replaced by the backup. Your current version is saved as a snapshot first, so you can go back.')}</p>
        </Modal>
      )}
      {restore && (
        <Modal title={t('Restore this snapshot?')} onClose={() => setRestore(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setRestore(null)}>{t('Cancel')}</button><button className="btn primary" onClick={() => doRestore(restore.id!)}>{t('Restore')}</button></>}>
          <p>{t('Go back to the version from {date}? Your current version is saved as a snapshot first, so you can undo this.', { date: formatDate(restore.t) })}</p>
        </Modal>
      )}
    </>
  );
}
