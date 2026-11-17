import { useEffect, useMemo, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section, Toggle } from './controls';
import { RecentSection } from './TalkSettings';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { clearLog, getLog, type LogEntry } from '../../lib/db';
import { insightStats, usageCsv } from '../../lib/talk';
import { saveFile } from '../../lib/files';
import { t } from '../../i18n';

/** Opt-in, on-device usage insights for families and therapists. */
export function DataPanel() {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings, showToast } = useStore.getState();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [range, setRange] = useState(14);
  const [confirmClear, setConfirmClear] = useState(false);

  // The whole log: "new words" compares with everything before the period, and export includes it all.
  useEffect(() => { getLog(p.id, 0).then(setLog).catch(() => setLog([])); }, [p.id, s.logging]);

  const stats = useMemo(() => insightStats(log, range), [log, range]);

  const max = Math.max(1, ...stats.days.map((d) => d.n));

  const exportCsv = async () => {
    const msg = await saveFile(`aacfree-usage-${p.name || 'profile'}.csv`, new Blob([usageCsv(log)], { type: 'text/csv' }));
    showToast(msg);
  };

  return (
    <>
      <Section title={t('Usage insights')} intro={t("Off by default. When on, AACFree keeps a private log on this device only. It is never uploaded. Remember: number of taps isn't the same as communication — use this to spot words to model and celebrate growth. Turn on “Model” in the bottom bar while you demonstrate, so your taps aren't counted as theirs.")}>
        <Toggle label={t('Keep a usage log')} checked={s.logging} onChange={(logging) => updateSettings({ logging })} />
      </Section>
      {log.length > 0 && (
        <>
          <div className="seg">
            {[7, 14, 30, 90].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{t('{v0} days', { v0: r })}</button>)}
          </div>
          <div className="stat-tiles">
            <div className="stat"><b>{stats.words}</b><small>{t('words tapped')}</small></div>
            <div className="stat"><b>{stats.unique}</b><small>{t('different words')}</small></div>
            <div className="stat"><b>{stats.sentences.length}</b><small>{t('messages spoken')}</small></div>
            <div className="stat"><b>{stats.avgLen.toFixed(1)}</b><small>{t('words per message')}</small></div>
            <div className="stat"><b>{stats.phrases}</b><small>{t('phrases used')}</small></div>
            <div className="stat"><b>{stats.modeled}</b><small>{t('modelled by partners (not counted)')}</small></div>
          </div>
          <h4>{t('Activity per day')}</h4>
          <div className="bars" role="img" aria-label={t('Activity per day chart')}>
            {stats.days.map((d, i) => (
              <div key={i} className="bar-col" title={`${d.label}: ${d.n}`}>
                <div className="bar" style={{ height: `${(d.n / max) * 100}%` }} />
                <small>{range <= 14 ? d.label : ''}</small>
              </div>
            ))}
          </div>
          <h4>{t('Most used words')}</h4>
          <ol className="top-words">
            {stats.top.map(([w, n]) => (
              <li key={w}><span>{w}</span><i style={{ width: `${(n / (stats.top[0]?.[1] ?? 1)) * 100}%` }} /><b>{n}</b></li>
            ))}
          </ol>
          {stats.newWords.length > 0 && (
            <>
              <h4>{t('New words in this period 🎉')}</h4>
              <p className="chips">{stats.newWords.slice(0, 40).map((w) => <span key={w} className="chip">{w}</span>)}</p>
            </>
          )}
          {!stats.hasEarlier && stats.words > 0 && (
            <p className="muted small">{t('New words show up once there is a log from before this period to compare with.')}</p>
          )}
          <h4>{t('Recent messages')}</h4>
          <ul className="recent-msgs">
            {stats.sentences.slice(-15).reverse().map((e) => <li key={e.id}><small>{new Date(e.t).toLocaleString()}</small> {e.text}</li>)}
          </ul>
          <div className="row">
            <button className="btn" onClick={exportCsv}>{t('Export CSV for a therapist ({v0} entries)', { v0: log.length })}</button>
            <button className="btn danger-outline" onClick={() => setConfirmClear(true)}>{t('Delete log')}</button>
          </div>
        </>
      )}
      {log.length === 0 && s.logging && <p className="muted">{t('Nothing logged yet. Data will appear here as the app is used.')}</p>}
      <RecentSection />
      {confirmClear && (
        <ConfirmDialog title={t('Delete the usage log?')} onClose={() => setConfirmClear(false)}
          onConfirm={async () => { await clearLog(p.id); setLog([]); showToast(t('Log cleared')); }}>
          <p>{t('All {v0} logged entries for this profile are deleted from this device. This cannot be undone. Export a CSV first if you want to keep a copy.', { v0: log.length })}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
