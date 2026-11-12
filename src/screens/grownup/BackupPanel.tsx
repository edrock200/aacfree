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

export function BackupPanel() {
  const p = useProfile();
  const data = useStore((st) => st.data);
  const { replaceData, showToast } = useStore.getState();
  const [snaps, setSnaps] = useState<Omit<Snapshot, 'data'>[]>([]);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<Omit<Snapshot, 'data'> | null>(null);

  const refresh = () => listSnapshots().then(setSnaps);
  useEffect(() => { refresh(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { showToast((e as Error).message || 'Something went wrong'); } finally { setBusy(false); }
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
    await replaceData(d, 'Before importing a backup');
    showToast('Backup restored');
    refresh();
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
    showToast(`Imported “${name}” as a new profile`);
  });

  const snapshotNow = () => run(async () => {
    await addSnapshot(data, 'Manual snapshot');
    showToast('Snapshot saved');
    refresh();
  });

  const doRestore = (id: number) => run(async () => {
    const s = await getSnapshot(id);
    if (!s) return;
    await replaceData(s.data, 'Before restoring a snapshot');
    setRestore(null);
    showToast('Restored');
    refresh();
  });

  const last = Number(localStorage.getItem('caleb:lastExport') ?? 0);

  return (
    <>
      <Section title="Backup file" intro="Saves everything — all profiles, boards, photos, recordings, phrases and settings — in one file. Keep a copy somewhere safe (cloud drive, email to yourself). Use it to move to a new device too.">
        <p className={last && Date.now() - last < 30 * 86400000 ? 'muted' : 'warn'}>
          {last ? `Last backup file: ${formatDate(last)}` : 'You have not saved a backup file yet.'}
        </p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={exportAll}>Save backup file</button>
          <button className="btn" disabled={busy} onClick={importAll}>Restore from file…</button>
        </div>
      </Section>
      <Section title="Automatic snapshots" intro="Caleb keeps the last 15 versions on this device: one per day, plus one before every restore, layout change or import.">
        <button className="btn small" disabled={busy} onClick={snapshotNow}>Take snapshot now</button>
        <ul className="snap-list">
          {snaps.map((s) => (
            <li key={s.id}>
              <span><b>{formatDate(s.t)}</b><small>{s.reason}</small></span>
              <button className="btn small" onClick={() => setRestore(s)}>Restore</button>
            </li>
          ))}
          {snaps.length === 0 && <li className="muted">No snapshots yet.</li>}
        </ul>
      </Section>
      <Section title="Share boards (Open Board Format)" intro="Export boards as .obz to use in other AAC apps (CoughDrop, Cboard, etc.), or import .obz/.obf boards made elsewhere. Imports become a new profile so nothing is overwritten.">
        <div className="row">
          <button className="btn" disabled={busy} onClick={exportObz}>Export boards (.obz)</button>
          <button className="btn" disabled={busy} onClick={importObz}>Import boards…</button>
        </div>
      </Section>
      {restore && (
        <Modal title="Restore this snapshot?" onClose={() => setRestore(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setRestore(null)}>Cancel</button><button className="btn primary" onClick={() => doRestore(restore.id!)}>Restore</button></>}>
          <p>Go back to the version from <b>{formatDate(restore.t)}</b>? Your current version is saved as a snapshot first, so you can undo this.</p>
        </Modal>
      )}
    </>
  );
}
