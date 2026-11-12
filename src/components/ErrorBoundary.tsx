import { Component, type ReactNode } from 'react';
import { getSnapshot, listSnapshots, loadData, saveData } from '../lib/db';
import { downloadBlob } from '../lib/util';

/**
 * Last line of defence: if rendering crashes, never leave a blank screen.
 * Offers reload, restoring the latest automatic snapshot, and saving raw data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; busy: boolean }> {
  state = { error: null as Error | null, busy: false };

  static getDerivedStateFromError(error: Error) {
    return { error, busy: false };
  }

  componentDidCatch(error: Error) {
    console.error('Caleb crashed', error);
  }

  restore = async () => {
    this.setState({ busy: true });
    try {
      const snaps = await listSnapshots();
      for (const s of snaps) {
        const snap = s.id != null ? await getSnapshot(s.id) : undefined;
        if (snap?.data?.profiles?.length) {
          await saveData(snap.data);
          location.reload();
          return;
        }
      }
      alert('No automatic backup was found on this device.');
    } catch {
      alert('Could not restore. Try “Save my data” and ask for help.');
    }
    this.setState({ busy: false });
  };

  saveRaw = async () => {
    try {
      const data = await loadData();
      downloadBlob(new Blob([JSON.stringify({ app: 'caleb', kind: 'raw', data })], { type: 'application/json' }), 'caleb-raw-data.json');
    } catch {
      alert('Could not read the saved data.');
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p>Caleb hit an unexpected problem. Your boards are usually still saved.</p>
        <div className="row">
          <button className="btn primary big" onClick={() => location.reload()}>Reload Caleb</button>
          <button className="btn big" disabled={this.state.busy} onClick={this.restore}>Restore last automatic backup</button>
          <button className="btn big" onClick={this.saveRaw}>Save my data</button>
        </div>
        <details><summary>Details</summary><pre>{String(this.state.error?.message ?? this.state.error)}</pre></details>
      </div>
    );
  }
}
