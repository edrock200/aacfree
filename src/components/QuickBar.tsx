import { useStore, useProfile } from '../store';
import { CellButton } from './CellButton';
import type { AACButton } from '../types';

/** Always-visible core / protest words ("no", "stop", "help", "break" …). */
export function QuickBar({ onEdit }: { onEdit: (index: number, b: AACButton | null) => void }) {
  const p = useProfile();
  const editMode = useStore((st) => st.editMode);
  const press = useStore.getState().pressButton;
  const items: (AACButton | null)[] = editMode ? [...p.quickBar, null] : p.quickBar;
  return (
    <div className="quickbar" data-scan-group style={{ gap: `${Math.max(4, p.settings.gap)}px` }}>
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
  );
}
