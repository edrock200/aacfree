import { useMemo, useState } from 'react';
import { useStore, useProfile } from '../store';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { SymbolPicker } from './SymbolPicker';
import { allCategories } from '../lib/library';
import { uid } from '../lib/util';
import type { AACButton, Cell } from '../types';

/**
 * Create a new category on the boards: a folder button (with an icon) that
 * opens a new board, optionally pre-filled from a symbol-library category.
 */
export function NewCategoryDialog({ parentBoardId, onClose, onCreated }: {
  parentBoardId: string; onClose: () => void; onCreated?: (boardId: string) => void;
}) {
  const p = useProfile();
  const library = useStore((s) => s.data.library);
  const cats = useMemo(() => allCategories(library), [library]);
  const { updateProfile, showToast } = useStore.getState();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | undefined>();
  const [from, setFrom] = useState('');
  const [picking, setPicking] = useState(false);
  const parent = p.boards[parentBoardId] ?? p.boards[p.rootId];

  const chooseFrom = (id: string) => {
    setFrom(id);
    const c = cats.find((x) => x.id === id);
    if (c) {
      if (!name.trim()) setName(c.name);
      if (!icon && c.icon) setIcon(c.icon);
    }
  };

  const create = () => {
    const id = uid('board-');
    const cols = parent.cols;
    const source = cats.find((c) => c.id === from);
    const buttons: AACButton[] = (source?.symbols ?? []).map((s) => ({
      id: uid('b'), label: s.label, symbol: s.symbol, type: s.type ?? 'noun',
    }));
    const rows = Math.max(3, Math.ceil(buttons.length / cols));
    const cells: Cell[] = Array.from({ length: rows * cols }, (_, i) => buttons[i] ?? null);
    const folder: AACButton = { id: uid('b'), label: name.trim(), type: 'folder', link: id, symbol: icon };
    let placedOn = parent.name;
    updateProfile((pp) => {
      pp.boards[id] = { id, name: name.trim(), cols, rows, cells, symbol: icon };
      // Put the folder in the first free square of this board, else on "More", else add a row.
      let target = pp.boards[parent.id];
      let idx = target.cells.findIndex((c) => !c);
      if (idx < 0 && pp.boards.more && parent.id !== 'more') {
        target = pp.boards.more;
        idx = target.cells.findIndex((c) => !c);
      }
      if (idx >= 0) target.cells[idx] = folder;
      else {
        target.rows += 1;
        target.cells.push(folder, ...Array(target.cols - 1).fill(null));
      }
      placedOn = target.name;
    }, { undoable: true });
    showToast(`“${name.trim()}” added to ${placedOn}`);
    onCreated?.(id);
    onClose();
  };

  return (
    <>
      <Modal title="New category" onClose={onClose}
        footer={<><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim()} onClick={create}>Create category</button></>}>
        <div className="cat-editor">
          <button className="cell cell-folder preview" onClick={() => setPicking(true)} aria-label="Choose category icon">
            {icon ? <Symbol value={icon} /> : <span className="muted">Tap for icon</span>}
            <span className="cell-label">{name || 'Category'}</span>
          </button>
          <div className="grow">
            <label className="field"><span>Name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Soccer, Grandma's, Minecraft" />
            </label>
            <label className="field"><span>Start with symbols from</span>
              <select value={from} onChange={(e) => chooseFrom(e.target.value)}>
                <option value="">Nothing (empty folder)</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbols.length}){c.builtIn ? '' : ' (yours)'}</option>)}
              </select>
            </label>
            <p className="muted small">The folder goes in the first empty square on “{parent.name}”. If that board is full, it goes on “More”.</p>
          </div>
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={name} noLibrarySave onClose={() => setPicking(false)} onPick={(s) => { setIcon(s); setPicking(false); }} />}
    </>
  );
}
