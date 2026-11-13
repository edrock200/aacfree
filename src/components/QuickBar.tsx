import { useLayoutEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { PressButton } from './PressButton';
import { t } from '../i18n';
import { useStore, useProfile } from '../store';
import { CellButton } from './CellButton';
import { IconGrid } from './Icons';
import type { AACButton } from '../types';

/** Always-visible core / protest words ("no", "stop", "help", "break" …). */
export function QuickBar({ onEdit }: { onEdit: (index: number, b: AACButton | null) => void }) {
  const p = useProfile();
  const bar = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const editMode = useStore((st) => st.editMode);
  const press = useStore.getState().pressButton;
  const items: (AACButton | null)[] = editMode ? [...p.quickBar, null] : p.quickBar;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, p.settings.gap]);
  return (
    <div className="quickbar-wrap">
      <div ref={bar} className="quickbar" data-scan-group style={{ gap: `${Math.max(4, p.settings.gap)}px` }}>
        {items.map((b, i) => (
          <CellButton
            key={b?.id ?? 'add'}
            button={b}
            settings={p.settings}
            editMode={editMode}
            compact
            onActivate={() => (editMode ? onEdit(i, b) : b && press(b))}
          />
        ))}
      </div>
      {/* Pinned at the end of the same row (no extra row), only when some quick words don't fit. */}
      {overflow && <div className="quickbar-access" data-scan-group>
        <PressButton className="quickbar-all" onPress={() => setExpanded(true)} aria-haspopup="dialog" aria-label={t('All quick words')} data-scan-item>
          <IconGrid /><span>{t('All')}</span>
        </PressButton>
      </div>}
      {expanded && <Modal title={t('All quick words')} onClose={() => setExpanded(false)}>
        <div className="quickbar-grid" data-scan-group>
          {items.map((b, i) => <CellButton key={b?.id ?? 'add'} button={b} settings={p.settings} editMode={editMode}
            onActivate={() => { setExpanded(false); if (editMode) onEdit(i, b); else if (b) press(b); }} />)}
        </div>
      </Modal>}
    </div>
  );
}
