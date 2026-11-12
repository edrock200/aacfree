import { useEffect, useState } from 'react';
import { applySyncedData, useStore, useProfile } from '../../store';
import { Choice, Section, Slider, Toggle } from './controls';
import { Modal } from '../../components/Modal';
import { pickFile, saveFile } from '../../lib/files';
import {
  MIN_PASSCODE, createSyncFile, mergeData, mergeDevices, normalizePasscode, openSyncFile, passcodeStrength, peekSyncFile, suggestPasscode,
  totalReceived, type DeviceInfo, type MergeSummary, type OpenedSync, type SyncConflict, type SyncFile,
} from '../../lib/sync';
import {
  autoSyncSupported, chooseExistingSyncFile, chooseNewSyncFile, getDeviceName, getKnownDevices, getSyncLog, getSyncPrefs, getSyncStatus,
  myDevices, recordManualSync, setDeviceName, setupAutoSync, subscribeSync, syncNow, turnOffAutoSync,
  type SyncLogEntry, type SyncPrefs, type SyncStatus, type SyncTarget,
} from '../../lib/autosync';
import { LEGACY, getDeviceId } from '../../lib/stamps';
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
        {canAuto && <button className="btn" onClick={async () => setSaved(await listSavedBackups({ interactive: true }))}>{t('Restore an automatic backup…')}</button>}
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
          {native && !saved.some((b) => b.source === 'device') && (
            <>
              <p className="muted small">{t('After Caleb is reinstalled, Android may hide the backups the old app saved. They are still in Documents/Caleb: choose one with the file picker.')}</p>
              <button className="btn" onClick={async () => { const text = await openCloudBackup().catch(() => null); if (text) { setSaved(null); onRestore(text, t('Backup file')); } }}>{t('Choose a backup file…')}</button>
            </>
          )}
        </Modal>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- sync between devices

/** "2 min ago", "3 h ago", or a date. */
function ago(ts: number): string {
  const s = Math.max(0, Date.now() - ts) / 1000;
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 24 * 3600) return t('{n} h ago', { n: Math.round(s / 3600) });
  return formatDate(ts);
}

function deviceLabel(id: string, devices: Record<string, DeviceInfo>): string {
  if (id === getDeviceId()) return t('this device');
  if (id === LEGACY || !Object.hasOwn(devices, id) || !devices[id]?.name) return t('another device');
  return devices[id].name;
}

type SummaryLike = Pick<MergeSummary, 'received' | 'added' | 'removed' | 'conflicts'> & { sent?: number };

/** One plain-language line, e.g. "3 changes from Tablet · 1 conflict (kept the newer)". */
function summaryLine(s: SummaryLike, devices: Record<string, DeviceInfo>): string {
  const parts: string[] = [];
  for (const [d, n] of Object.entries(s.received)) {
    if (!n) continue;
    parts.push(n === 1 ? t('1 change from {device}', { device: deviceLabel(d, devices) }) : t('{n} changes from {device}', { n, device: deviceLabel(d, devices) }));
  }
  if (s.sent) parts.push(s.sent === 1 ? t('1 change sent') : t('{n} changes sent', { n: s.sent }));
  if (s.added.length) parts.push(`${t('New profiles')}: ${s.added.join(', ')}`);
  if (s.removed.length) parts.push(`${t('Profiles removed on another device')}: ${s.removed.join(', ')}`);
  if (s.conflicts.length) parts.push(s.conflicts.length === 1 ? t('1 conflict (kept the newer)') : t('{n} conflicts (kept the newer)', { n: s.conflicts.length }));
  return parts.length ? parts.join(' · ') : t('Already up to date');
}

function conflictWhat(c: SyncConflict): string {
  const w = c.what;
  switch (c.kind) {
    case 'button': return c.where ? t('Button “{what}” on {board}', { what: w, board: c.where }) : t('Button “{what}”', { what: w });
    case 'board': return t('Board “{what}”', { what: w });
    case 'phrase': return t('Phrase “{what}”', { what: w });
    case 'category': return t('Phrase group “{what}”', { what: w });
    case 'schedule': return t('Schedule “{what}”', { what: w });
    case 'quick': return t('Quick bar button “{what}”', { what: w });
    case 'about': return t('About me');
    case 'setting': return t('Setting “{what}”', { what: w });
    case 'profile': return t('Profile name');
    case 'library': return t('Symbol library: “{what}”', { what: w });
    default: return w;
  }
}

function ConflictList({ conflicts, devices }: { conflicts: SyncConflict[]; devices: Record<string, DeviceInfo> }) {
  if (!conflicts.length) return null;
  return (
    <ul className="snap-list">
      {conflicts.map((c, i) => (
        <li key={i}>
          <span>
            <b>{c.profile ? `${c.profile}: ` : ''}{conflictWhat(c)}</b>
            <small>
              {c.keptDeleted
                ? t('Kept the deletion from {device} ({time}).', { device: deviceLabel(c.kept.d, devices), time: formatDate(c.kept.t) })
                : t('Kept the change from {device} ({time}).', { device: deviceLabel(c.kept.d, devices), time: formatDate(c.kept.t) })}
              {' '}{t('The other version is in Automatic snapshots.')}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StrengthHint({ code }: { code: string }) {
  const { level } = passcodeStrength(code);
  const text = {
    short: t('Too short: use at least {n} letters or numbers.', { n: MIN_PASSCODE }),
    weak: t('Easy to guess. Add more words or numbers.'),
    ok: t('Okay. A longer passcode is safer.'),
    strong: t('Strong passcode.'),
  }[level];
  return <small className={level === 'short' || level === 'weak' ? 'warn' : 'muted'} role="status">{text}</small>;
}

type Choice = { target: SyncTarget; handle?: unknown };

/** Automatic sync through one shared file (Android, desktop Chrome/Edge). */
function AutoSync() {
  const { showToast } = useStore.getState();
  const [prefs, setPrefs] = useState<SyncPrefs | null>(null);
  const [status, setStatus] = useState<SyncStatus>({});
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [devices, setDevices] = useState<Record<string, DeviceInfo>>({});
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [setup, setSetup] = useState<null | { step: 'choose' } | { step: 'pass'; mode: 'create' | 'join'; choice: Choice }>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const refresh = async () => {
    setPrefs(await getSyncPrefs());
    setStatus({ ...(await getSyncStatus()) });
    setLog(await getSyncLog());
    setDevices(await getKnownDevices());
    setName(await getDeviceName());
  };
  useEffect(() => {
    refresh();
    const off = subscribeSync(() => { refresh(); });
    const iv = setInterval(() => setTick((n) => n + 1), 30_000); // keeps "2 min ago" fresh
    return () => { off(); clearInterval(iv); };
  }, []);
  if (!prefs) return null;

  const pick = async (mode: 'create' | 'join') => {
    setError('');
    const choice = mode === 'create' ? await chooseNewSyncFile() : await chooseExistingSyncFile();
    if (!choice) return;
    setCode(mode === 'create' ? suggestPasscode() : '');
    setSetup({ step: 'pass', mode, choice });
  };

  const start = async () => {
    if (setup?.step !== 'pass') return;
    setBusy(true); setError('');
    try {
      const entry = await setupAutoSync(setup.choice as Parameters<typeof setupAutoSync>[0], code);
      setSetup(null); setCode('');
      showToast(entry ? summaryLine(entry, await getKnownDevices()) : t('Automatic sync is on'));
    } catch (e) { setError(t((e as Error).message)); } finally { setBusy(false); refresh(); }
  };

  const now = async () => {
    setBusy(true);
    try {
      const entry = await syncNow();
      showToast(entry ? summaryLine(entry, await getKnownDevices()) : t('Synced'));
    } catch (e) { showToast(t((e as Error).message)); } finally { setBusy(false); refresh(); }
  };

  const saveName = async () => { await setDeviceName(name); setRenaming(false); refresh(); };

  if (!prefs.enabled) {
    return (
      <div className="sync-auto">
        <p><b>{t('Automatic sync')}</b><br /><small className="muted">{t('Pick one sync file, for example in Google Drive, OneDrive or Dropbox. Every device that uses it stays up to date by itself.')}</small></p>
        <div className="row"><button className="btn primary" onClick={() => { setError(''); setSetup({ step: 'choose' }); }}>{t('Set up automatic sync…')}</button></div>
        {setup?.step === 'choose' && (
          <Modal title={t('Set up automatic sync')} onClose={() => setSetup(null)}>
            <p>{t('Is this the first device to sync?')}</p>
            <div className="field">
              <button className="btn primary" onClick={() => pick('create')}>{t('Yes: create a new sync file…')}</button>
              <small>{t('Choose a place every device can reach, such as a Google Drive, OneDrive or Dropbox folder.')}</small>
            </div>
            <div className="field">
              <button className="btn" onClick={() => pick('join')}>{t('No: choose the sync file another device made…')}</button>
              <small>{t('You need the passcode from the first device.')}</small>
            </div>
          </Modal>
        )}
        {setup?.step === 'pass' && (
          <Modal title={t('Set up automatic sync')} onClose={() => setSetup(null)}
            footer={<><span className="spacer" /><button className="btn" onClick={() => setSetup(null)}>{t('Cancel')}</button>
              <button className="btn primary" disabled={busy || normalizePasscode(code).length < MIN_PASSCODE} onClick={start}>{busy ? t('Syncing…') : t('Start syncing')}</button></>}>
            <p className="muted small">{t('Sync file')}: <b>{setup.choice.target.name}</b></p>
            {setup.mode === 'create' ? (
              <>
                <label className="field"><span>{t('Sync passcode')}</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} aria-label={t('Sync passcode')} />
                  <StrengthHint code={code} />
                </label>
                <div className="row"><button className="btn small" onClick={() => setCode(suggestPasscode())}>{t('Make a new passcode')}</button></div>
                <p className="muted small">{t('Write the passcode down and keep it safe. You type it once on every device that syncs. You can also type your own.')}</p>
              </>
            ) : (
              <label className="field"><span>{t('Sync passcode (from the first device)')}</span>
                <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} aria-label={t('Sync passcode')} />
              </label>
            )}
            <p className="muted small">{t('Changes from every device are combined. If the same thing was changed on two devices, the newer change is kept and a snapshot is saved first.')}</p>
            {error && <p className="error">{error}</p>}
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="sync-auto">
      <p>
        <b>{t('Automatic sync is on')}</b><br />
        <small className="muted">{t('Sync file')}: {prefs.target?.name}</small>
      </p>
      <p className={status.error ? 'warn' : 'muted small'} role="status">
        {status.running ? t('Syncing…') : status.lastOk ? `${t('Last synced')} ${ago(status.lastOk)}` : t('Not synced yet.')}
        {status.error && !status.running ? ` — ${t(status.error)}` : ''}
      </p>
      <div className="setting">
        <span className="setting-text"><b>{t('This device’s name')}</b><small>{t('Shown on other devices, e.g. “3 changes from Tablet”.')}</small></span>
        {renaming ? (
          <span className="row">
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={t('This device’s name')} />
            <button className="btn small" onClick={saveName}>{t('Save')}</button>
          </span>
        ) : (
          <span className="row"><b>{name}</b><button className="btn small" onClick={() => setRenaming(true)}>{t('Rename')}</button></span>
        )}
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy || status.running} onClick={now}>{t('Sync now')}</button>
        <button className="btn" onClick={async () => { if (confirm(t('Stop syncing on this device? Nothing is deleted: this device and the sync file keep everything.'))) { await turnOffAutoSync(); refresh(); } }}>{t('Turn off automatic sync')}</button>
      </div>
      {log.length > 0 && (
        <>
          <p className="muted small"><b>{t('Recent syncs')}</b></p>
          <ul className="snap-list">
            {log.slice(0, 5).map((e, i) => (
              <li key={e.t + ':' + i} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <span>
                  <b>{formatDate(e.t)}</b>
                  <small>{summaryLine(e, devices)}</small>
                </span>
                {e.conflicts.length > 0 && (
                  open === i
                    ? <ConflictList conflicts={e.conflicts} devices={devices} />
                    : <button className="btn small" onClick={() => setOpen(i)}>{t('Show conflicts')}</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SyncSection() {
  const data = useStore((st) => st.data);
  const p = useProfile();
  const { showToast } = useStore.getState();
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [chosen, setChosen] = useState<string[]>([p.id]);
  const [incoming, setIncoming] = useState<SyncFile | null>(null);
  const [rcode, setRcode] = useState('');
  const [preview, setPreview] = useState<{ opened: OpenedSync; summary: MergeSummary; devices: Record<string, DeviceInfo> } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const auto = autoSyncSupported();

  const send = async () => {
    setBusy(true); setError('');
    try {
      const blob = await createSyncFile(useStore.getState().data, chosen, code, await myDevices());
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
      const opened = await openSyncFile(incoming, rcode);
      const r = mergeData(useStore.getState().data, opened.data);
      setPreview({ opened, summary: r.summary, devices: mergeDevices(await getKnownDevices(), opened.devices) });
    } catch (e) { setError(t((e as Error).message)); } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      // One snapshot, then merge again with the very latest data (nothing changed meanwhile is lost).
      await addSnapshot(useStore.getState().data, 'Before syncing from another device');
      const r = mergeData(useStore.getState().data, preview.opened.data);
      applySyncedData(r.data);
      await recordManualSync(r.summary, preview.opened.devices);
      showToast(summaryLine(r.summary, preview.devices));
      setPreview(null); setIncoming(null);
    } catch (e) { showToast(t((e as Error).message)); } finally { setBusy(false); }
  };

  const created = incoming ? Date.parse(incoming.createdAt) : NaN;
  return (
    <Section title={t('Sync between devices (encrypted)')} intro={t('Keep a parent’s phone and the user’s tablet in step without any account or server. Everything is locked with a passcode only your family knows. Changes from every device are combined, button by button.')}>
      {auto
        ? <AutoSync />
        : <p className="muted small">{t('This browser can’t keep a sync file (iPad, iPhone and Firefox). Use “Send” and “Receive” below, or use the Android app or Chrome on a computer for automatic sync.')}</p>}
      <p className="muted small"><b>{t('Send or receive a sync file')}</b><br />{t('Move the file any way you like (share, email, cloud drive), then “Receive” it on the other device.')}</p>
      <div className="row">
        <button className="btn" onClick={() => { setSending(true); setCode(suggestPasscode()); setError(''); setChosen([p.id]); }}>{t('Send to another device…')}</button>
        <button className="btn" onClick={receive}>{t('Receive from another device…')}</button>
      </div>
      {sending && (
        <Modal title={t('Send to another device')} onClose={() => setSending(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setSending(false)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={busy || normalizePasscode(code).length < MIN_PASSCODE || !chosen.length} onClick={send}>{busy ? t('Locking…') : t('Create sync file')}</button></>}>
          <label className="field"><span>{t('Passcode (you’ll type it on the other device)')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} />
            <StrengthHint code={code} />
          </label>
          <div className="field"><span>{t('Profiles to send')}</span>
            {data.profiles.map((x) => (
              <label key={x.id} className="check"><input type="checkbox" checked={chosen.includes(x.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, x.id] : chosen.filter((y) => y !== x.id))} /><span>{x.name || t('Unnamed')}</span></label>
            ))}
          </div>
          <p className="muted small">{t('Write the passcode down or tell it to the other person. Don’t send it together with the file.')}</p>
          {error && <p className="error">{error}</p>}
        </Modal>
      )}
      {incoming && !preview && (
        <Modal title={t('Receive from another device')} onClose={() => setIncoming(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setIncoming(null)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={busy || !rcode} onClick={unlock}>{busy ? t('Unlocking…') : t('Unlock')}</button></>}>
          {incoming.v === 1
            ? <p>{t('This file contains')}: <b>{incoming.profiles.join(', ')}</b>{Number.isFinite(created) ? ` (${formatDate(created)})` : ''}.</p>
            : <p>{t('Sync file from {date}.', { date: Number.isFinite(created) ? formatDate(created) : '?' })}</p>}
          <label className="field"><span>{t('Passcode')}</span><input autoFocus value={rcode} onChange={(e) => setRcode(e.target.value)} autoComplete="off" spellCheck={false} /></label>
          {error && <p className="error">{error}</p>}
        </Modal>
      )}
      {preview && (
        <Modal title={t('Ready to sync')} onClose={() => setPreview(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setPreview(null)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={busy} onClick={apply}>{t('Sync now')}</button></>}>
          <p>{t('This file contains')}: <b>{preview.opened.data.profiles.map((x) => x.name || t('Unnamed')).join(', ')}</b></p>
          <p>{totalReceived(preview.summary) || preview.summary.added.length || preview.summary.removed.length
            ? summaryLine({ ...preview.summary, sent: 0 }, preview.devices)
            : t('Nothing new for this device.')}</p>
          <ConflictList conflicts={preview.summary.conflicts} devices={preview.devices} />
          <p className="muted small">{t('A snapshot is saved first, so you can undo this from Automatic snapshots.')}</p>
        </Modal>
      )}
    </Section>
  );
}
