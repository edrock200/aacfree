import { lazy, Suspense, useMemo, useState } from 'react';
import { useStore, useProfile } from '../store';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { SymbolPicker } from './SymbolPicker';
import { allCategories } from '../lib/library';
import { uid } from '../lib/util';
import { placeFolder } from '../lib/boards';
import type { AACButton, Cell } from '../types';
import { t } from '../i18n';

// Loaded only when used (this dialog is also part of the Talk screen's chunk).
const BoardImport = lazy(() => import('./BoardImport').then((m) => ({ default: m.BoardImport })));

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
  const [importing, setImporting] = useState(false);
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
      placedOn = placeFolder(pp, parent.id, folder).name;
    }, { undoable: true });
    showToast(t('“{v0}” added to {v1}', { v0: name.trim(), v1: placedOn }));
    onCreated?.(id);
    onClose();
  };

  return (
    <>
      <Modal title={t('New category')} onClose={onClose}
        footer={<><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={create}>{t('Create category')}</button></>}>
        <div className="cat-editor">
          <button className="cell cell-folder preview" onClick={() => setPicking(true)} aria-label={t('Choose category icon')}>
            {icon ? <Symbol value={icon} /> : <span className="muted">{t('Tap for icon')}</span>}
            <span className="cell-label">{name || t('Category')}</span>
          </button>
          <div className="grow">
            <label className="field"><span>{t('Name')}</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Soccer, Grandma's, Minecraft")} />
            </label>
            <label className="field"><span>{t('Start with symbols from')}</span>
              <select value={from} onChange={(e) => chooseFrom(e.target.value)}>
                <option value="">{t('Nothing (empty folder)')}</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbols.length}){c.builtIn ? '' : ` ${t('(yours)')}`}</option>)}
              </select>
            </label>
            <p className="muted small">{t('The folder goes in the first empty square on “{board}”. If that board is full, it goes on “More”.', { board: parent.name })}</p>
            <button className="btn small" onClick={() => setImporting(true)}>{t('Or import a board from a picture…')}</button>
          </div>
        </div>
      </Modal>
      {importing && (
        <Suspense fallback={null}>
          <BoardImport parentBoardId={parent.id} onClose={() => setImporting(false)} onCreated={(id) => { onCreated?.(id); onClose(); }} />
        </Suspense>
      )}
      {picking && <SymbolPicker initialQuery={name} noLibrarySave onClose={() => setPicking(false)} onPick={(s) => { setIcon(s); setPicking(false); }} />}
    </>
  );
}
