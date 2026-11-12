import { useEffect, useMemo, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Section, Toggle } from './controls';
import { clearLog, getLog, type LogEntry } from '../../lib/db';
import { saveFile } from '../../lib/files';
import { t } from '../../i18n';

const DAY = 86400000;

/** Opt-in, on-device usage insights for families and therapists. */
export function DataPanel() {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings, showToast } = useStore.getState();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [range, setRange] = useState(14);

  useEffect(() => { getLog(p.id, Date.now() - 90 * DAY).then(setLog); }, [p.id, s.logging]);

  const stats = useMemo(() => {
    const since = Date.now() - range * DAY;
    const all = log.filter((e) => e.t >= since);
    // Partner modelling is shown separately: it is not the person's own communication.
    const modeled = all.filter((e) => e.modeled).length;
    const inRange = all.filter((e) => !e.modeled);
    const words = inRange.filter((e) => e.kind === 'word');
    const counts = new Map<string, number>();
    words.forEach((w) => counts.set(w.text.toLowerCase(), (counts.get(w.text.toLowerCase()) ?? 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const days: { label: string; n: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const t0 = start.getTime() - i * DAY;
      const n = inRange.filter((e) => e.t >= t0 && e.t < t0 + DAY).length;
      days.push({ label: new Date(t0).toLocaleDateString(undefined, { weekday: 'narrow', day: 'numeric' }), n });
    }
    const before = new Set(log.filter((e) => e.t < since && e.kind === 'word').map((e) => e.text.toLowerCase()));
    const newWords = [...counts.keys()].filter((w) => !before.has(w));
    const sentences = inRange.filter((e) => e.kind === 'sentence');
    const avgLen = sentences.length ? sentences.reduce((a, e) => a + e.text.split(/\s+/).length, 0) / sentences.length : 0;
    return { modeled, total: inRange.length, words: words.length, unique: counts.size, top, days, newWords, sentences, avgLen, phrases: inRange.filter((e) => e.kind === 'phrase').length };
  }, [log, range]);

  const max = Math.max(1, ...stats.days.map((d) => d.n));

  const exportCsv = async () => {
    const rows = [['time', 'kind', 'by', 'text'], ...log.map((e) => [new Date(e.t).toISOString(), e.kind, e.modeled ? 'partner' : 'user', `"${e.text.replace(/"/g, '""')}"`])];
    const msg = await saveFile(`caleb-usage-${p.name || 'profile'}.csv`, new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    showToast(msg);
  };

  return (
    <>
      <Section title={t('Usage insights')} intro={t("Off by default. When on, Caleb keeps a private log on this device only. It is never uploaded. Remember: number of taps isn't the same as communication — use this to spot words to model and celebrate growth. Turn on “Model” in the bottom bar while you demonstrate, so your taps aren't counted as theirs.")}>
        <Toggle label={t('Keep a usage log')} checked={s.logging} onChange={(logging) => updateSettings({ logging })} />
      </Section>
      {log.length > 0 && (
        <>
          <div className="seg">
            {[7, 14, 30, 90].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r} days</button>)}
          </div>
          <div className="stat-tiles">
            <div className="stat"><b>{stats.words}</b><small>{t('words tapped')}</small></div>
            <div className="stat"><b>{stats.unique}</b><small>{t('different words')}</small></div>
            <div className="stat"><b>{stats.sentences.length}</b><small>{t('messages spoken')}</small></div>
            <div className="stat"><b>{stats.avgLen.toFixed(1)}</b><small>{t('words per message')}</small></div>
            <div className="stat"><b>{stats.phrases}</b><small>{t('phrases used')}</small></div>
            <div className="stat"><b>{stats.modeled}</b><small>modelled by partners (not counted)</small></div>
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
          <h4>{t('Recent messages')}</h4>
          <ul className="recent-msgs">
            {stats.sentences.slice(-15).reverse().map((e) => <li key={e.id}><small>{new Date(e.t).toLocaleString()}</small> {e.text}</li>)}
          </ul>
          <div className="row">
            <button className="btn" onClick={exportCsv}>Export CSV (for therapist)</button>
            <button className="btn danger-outline" onClick={async () => { await clearLog(p.id); setLog([]); showToast(t('Log cleared')); }}>{t('Delete log')}</button>
          </div>
        </>
      )}
      {log.length === 0 && s.logging && <p className="muted">{t('Nothing logged yet. Data will appear here as the app is used.')}</p>}
    </>
  );
}
