import { Component, type ReactNode } from 'react';
import { addSnapshot, getRev, getSnapshot, listSnapshots, loadData, saveDataChecked } from '../lib/db';
import { downloadBlob, formatDate } from '../lib/util';
import { keepDeviceLock, migrateLock, withoutPin } from '../lib/lock';
import { blockSaves, isSaveBlocked, migrate, useStore } from '../store';
import { t } from '../i18n';
import type { AppData } from '../types';

/** Snapshot taken just before a crash-screen restore (never offered as the version to go back to). */
export const CRASH_SNAPSHOT_REASON = 'Before restoring after a problem';
/** Each restore from the crash screen steps one snapshot further back, so a snapshot that also crashes can't loop. */
const STEP_KEY = 'caleb:crashRestoreBefore';

const getStep = () => { try { return Number(sessionStorage.getItem(STEP_KEY)) || Infinity; } catch { return Infinity; } };
const setStep = (id: number) => { try { sessionStorage.setItem(STEP_KEY, String(id)); } catch { /* ignore */ } };

/**
 * Last line of defence: if rendering crashes, never leave a blank screen.
 * Offers reload, going back to an automatic snapshot (after confirming, and
 * after saving the current version as a snapshot), and saving raw data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; busy: boolean }> {
  state = { error: null as Error | null, busy: false };

  static getDerivedStateFromError(error: Error) {
    return { error, busy: false };
  }

  componentDidCatch(error: Error) {
    console.error('AACFree crashed', error);
  }

  restore = async () => {
    this.setState({ busy: true });
    try {
      const before = getStep();
      const snaps = (await listSnapshots()).filter((s) => s.id != null && s.id < before && s.reason !== CRASH_SNAPSHOT_REASON);
      for (const s of snaps) {
        const snap = await getSnapshot(s.id!);
        let data: AppData;
        try { data = migrate(structuredClone(snap!.data)); } catch { continue; } // unusable: try an older one
        const ok = window.confirm(t('Go back to the version from {date} ({reason})? The current version is saved as a snapshot first.', {
          date: formatDate(s.t), reason: t(s.reason),
        }));
        if (!ok) { this.setState({ busy: false }); return; }
        // Keep what is there now: the in-memory version if AACFree loaded, otherwise what is stored.
        const st = useStore.getState();
        const current = isSaveBlocked() ? null : st.loaded ? st.data : await loadData().catch(() => undefined);
        if (current?.profiles?.length) {
          await addSnapshot(current, CRASH_SNAPSHOT_REASON);
          if (current.grownUpLock) keepDeviceLock(data, current); // going back never changes the settings lock
        }
        // Nothing still in memory may overwrite the restore before the reload.
        blockSaves();
        let rev = await getRev();
        if ((await saveDataChecked(data, rev)) === null) {
          rev = await getRev();
          if ((await saveDataChecked(data, rev)) === null) throw new Error('conflict');
        }
        setStep(s.id!);
        location.reload();
        return;
      }
      alert(t(before === Infinity ? 'No automatic backup was found on this device.' : 'No older automatic backup was found on this device.'));
    } catch (e) {
      console.error('Restore failed', e);
      alert(t('Could not restore. Try “Save my data” and ask for help.'));
    }
    this.setState({ busy: false });
  };

  saveRaw = async () => {
    try {
      let data: unknown = await loadData();
      // Plain files never carry the grown-up PIN.
      try { if (Array.isArray((data as AppData)?.profiles)) data = withoutPin(migrateLock(structuredClone(data as AppData))); } catch { /* keep as is */ }
      downloadBlob(new Blob([JSON.stringify({ app: 'caleb', kind: 'raw', data })], { type: 'application/json' }), 'aacfree-raw-data.json');
    } catch {
      alert(t('Could not read the saved data.'));
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h1>{t('Something went wrong')}</h1>
        <p>{t('AACFree hit an unexpected problem. Your boards are usually still saved.')}</p>
        <div className="row">
          <button className="btn primary big" onClick={() => location.reload()}>{t('Reload AACFree')}</button>
          <button className="btn big" disabled={this.state.busy} onClick={this.restore}>{t('Restore last automatic backup')}</button>
          <button className="btn big" onClick={this.saveRaw}>{t('Save my data')}</button>
        </div>
        <details><summary>{t('Details')}</summary><pre>{String(this.state.error?.message ?? this.state.error)}</pre></details>
      </div>
    );
  }
}
