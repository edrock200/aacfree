import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { useProfile } from '../store';
import { searchBundled } from '../data/defaults';
import { IconSearch } from './Icons';
import { t } from '../i18n';

export interface PickedItem { label: string; symbol?: string }

/** Pick an item from the person's own vocabulary (or any built-in symbol). */
export function VocabPicker({ title = 'Choose', onPick, onClose }: { title?: string; onPick: (i: PickedItem) => void; onClose: () => void }) {
  const p = useProfile();
  const [q, setQ] = useState('');
  const all = useMemo(() => {
    const seen = new Set<string>();
    const out: PickedItem[] = [];
    for (const b of Object.values(p.boards)) for (const c of b.cells) {
      if (!c || c.link || c.action || !c.symbol) continue;
      const k = c.label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ label: c.label, symbol: c.symbol });
    }
    return out;
  }, [p.boards]);
  const ql = q.trim().toLowerCase();
  let results = ql ? all.filter((x) => x.label.toLowerCase().includes(ql)) : all.slice(0, 80);
  if (ql && results.length < 10) {
    results = [...results, ...searchBundled(ql, 20).map((r) => ({ label: r.keyword, symbol: r.symbol }))
      .filter((r) => !results.some((x) => x.label === r.label))];
  }
  return (
    <Modal title={t(title)} onClose={onClose} wide>
      <label className="search">
        <IconSearch size={20} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search words…')} />
      </label>
      <div className="sym-grid">
        {ql && !results.some((r) => r.label.toLowerCase() === ql) && (
          <button className="sym-opt text-only" onClick={() => onPick({ label: q.trim() })}><span className="big">“{q.trim()}”</span><span>{t('use text')}</span></button>
        )}
        {results.map((r, i) => (
          <button key={r.label + i} className="sym-opt" onClick={() => onPick(r)}>
            <Symbol value={r.symbol} />
            <span>{r.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
