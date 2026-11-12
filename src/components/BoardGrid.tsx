import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AACButton, Board, Cell, Settings } from '../types';
import { CellButton } from './CellButton';
import { PressButton } from './PressButton';
import { t } from '../i18n';

interface Props {
  board: Board;
  settings: Settings;
  editMode: boolean;
  highlight: string[];
  selectedIndex?: number | null;
  onCell: (index: number, button: AACButton | null) => void;
  onLongPress?: (button: AACButton) => void;
}

const PAGE_BAR = 64;

/**
 * A board grid. Boards taller than the screen are split into fixed pages with
 * big Previous / Next buttons in constant positions (no free scrolling), so a
 * word is always in the same spot on the same page.
 */
export const BoardGrid = memo(function BoardGrid({ board, settings: s, editMode, highlight, selectedIndex, onCell, onLongPress }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(board.rows);
  const [page, setPage] = useState(0);

  // How many rows fit at the minimum button size?
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const min = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--min-cell')) || 64;
      const h = el.clientHeight;
      const rowsAll = Math.floor((h + s.gap) / (min + s.gap));
      const rowsPaged = Math.floor((h - PAGE_BAR + s.gap) / (min + s.gap));
      setFit(rowsAll >= board.rows ? board.rows : Math.max(1, rowsPaged));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.rows, s.gap]);

  const paged = fit < board.rows;
  const rowsPerPage = paged ? fit : board.rows;
  const pages = Math.max(1, Math.ceil(board.rows / rowsPerPage));

  useEffect(() => { setPage(0); }, [board.id]);
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);
  // Find word: jump to the page that holds the highlighted button.
  useEffect(() => {
    if (!highlight.length || !paged) return;
    const i = board.cells.findIndex((c) => c && highlight.includes(c.id));
    if (i >= 0) setPage(Math.floor(Math.floor(i / board.cols) / rowsPerPage));
  }, [highlight, paged, board, rowsPerPage]);

  const start = page * rowsPerPage * board.cols;
  const cells: { b: Cell; i: number }[] = [];
  for (let k = 0; k < rowsPerPage * board.cols; k++) {
    const i = start + k;
    cells.push({ b: i < board.cells.length ? board.cells[i] : null, i });
  }

  return (
    <div className="board-wrap" ref={wrap}>
      <div
        className={`grid ${paged ? 'paged' : ''}`}
        data-scan-group
        data-scan-grid
        style={{
          gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowsPerPage}, minmax(var(--min-cell), 1fr))`,
          gap: `${s.gap}px`,
        }}
      >
        {cells.map(({ b, i }) => (
          <CellButton
            key={b?.id ?? `empty-${i}`}
            button={i < board.cells.length ? b : null}
            settings={s}
            editMode={editMode && i < board.cells.length}
            row={Math.floor(i / board.cols)}
            highlighted={!!b && highlight.includes(b.id)}
            selected={selectedIndex === i}
            index={i}
            onCell={onCell}
            onLong={onLongPress}
          />
        ))}
      </div>
      {paged && (
        <div className="page-bar" data-scan-group style={{ height: PAGE_BAR - 8 }}>
          <PressButton className="btn page-btn" data-scan-item disabled={page === 0} onPress={() => setPage((pg) => Math.max(0, pg - 1))} aria-label={t('Previous page')}
            touch={editMode ? { holdMs: 0, debounceMs: 0, pressOnDown: false } : undefined}>{t('◀ Previous')}</PressButton>
          <span className="page-dots" role="img" aria-label={t('Page {n} of {total}', { n: page + 1, total: pages })}>
            {Array.from({ length: pages }, (_, k) => <i key={k} className={k === page ? 'on' : ''} />)}
          </span>
          <PressButton className="btn page-btn" data-scan-item disabled={page >= pages - 1} onPress={() => setPage((pg) => Math.min(pages - 1, pg + 1))} aria-label={t('Next page')}
            touch={editMode ? { holdMs: 0, debounceMs: 0, pressOnDown: false } : undefined}>{t('Next ▶')}</PressButton>
        </div>
      )}
    </div>
  );
});
