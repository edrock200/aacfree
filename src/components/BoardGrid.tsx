import type { AACButton, Board, Settings } from '../types';
import { CellButton } from './CellButton';

interface Props {
  board: Board;
  settings: Settings;
  editMode: boolean;
  highlight: string[];
  selectedIndex?: number | null;
  onCell: (index: number, button: AACButton | null) => void;
  onLongPress?: (button: AACButton) => void;
}

export function BoardGrid({ board, settings: s, editMode, highlight, selectedIndex, onCell, onLongPress }: Props) {
  // Trim fully-empty trailing rows for display (keeps positions stable).
  return (
    <div
      className="grid"
      data-scan-group
      data-scan-grid
      style={{
        gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${board.rows}, minmax(var(--min-cell), 1fr))`,
        gap: `${s.gap}px`,
      }}
    >
      {board.cells.map((b, i) => (
        <CellButton
          key={b?.id ?? `empty-${i}`}
          button={b}
          settings={s}
          editMode={editMode}
          row={Math.floor(i / board.cols)}
          highlighted={!!b && highlight.includes(b.id)}
          selected={selectedIndex === i}
          onActivate={() => onCell(i, b)}
          onLongPress={b && onLongPress && !b.link && !b.action ? () => onLongPress(b) : undefined}
        />
      ))}
    </div>
  );
}
