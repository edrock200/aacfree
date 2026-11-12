import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { useProfile } from '../store';
import { PressButton } from './PressButton';
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
    <Modal title={title} onClose={onClose} wide>
      {/* While scanning a partner can still tap and type here; the switch scans the pictures below. */}
      <label className="search scan-exempt">
        <IconSearch size={20} />
        <input autoFocus={!p.settings.scanning} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search words…')} />
      </label>
      {/* Rows are worked out from the layout, so row/column scanning works in the picture grid. */}
      <div className="sym-grid" data-scan-group data-scan-grid>
        {ql && !results.some((r) => r.label.toLowerCase() === ql) && (
          <PressButton className="sym-opt text-only" onPress={() => onPick({ label: q.trim() })} data-scan-item><span className="big">“{q.trim()}”</span><span>{t('use text')}</span></PressButton>
        )}
        {results.map((r, i) => (
          <PressButton key={r.label + i} className="sym-opt" onPress={() => onPick(r)} data-scan-item aria-label={r.label}>
            <Symbol value={r.symbol} />
            <span>{r.label}</span>
          </PressButton>
        ))}
      </div>
    </Modal>
  );
}
