import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useProfile } from '../store';
import { BoardGrid } from '../components/BoardGrid';
import { NewCategoryDialog } from '../components/NewCategoryDialog';
import { AddWordDialog } from '../components/AddWordDialog';
import { ButtonEditor } from '../components/ButtonEditor';
import { FormsPopover } from '../components/FormsPopover';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { addSnapshot } from '../lib/db';
import { Symbol } from '../components/Symbol';
import { resizeBoard, orphanBoards } from '../lib/boards';
import type { AACButton, Board } from '../types';
import { IconCheck, IconEyeOff, IconPlus, IconSettings, IconUndo } from '../components/Icons';
import { t } from '../i18n';

export const TalkScreen = memo(function TalkScreen() {
  const p = useProfile();
  const s = p.settings;
  const boardStack = useStore((st) => st.boardStack);
  const editMode = useStore((st) => st.editMode);
  const highlight = useStore((st) => st.highlight);
  const undo = useStore((st) => st.undo);
  const { pressButton, updateProfile, undoEdit, setEditMode, addWord, speakText, showToast, openBoard } = useStore.getState();

  const boardId = boardStack[boardStack.length - 1];
  const board = p.boards[boardId] ?? p.boards[p.rootId];
  const [editing, setEditing] = useState<{ index: number; button: AACButton | null } | null>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  const [formsButton, setFormsButton] = useState<AACButton | null>(null);
  const [boardSettings, setBoardSettings] = useState(false);
  const [newCat, setNewCat] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  /** Show/Hide mode: one tap masks or reveals a word (to grow vocabulary over time). */
  const [hideMode, setHideMode] = useState(false);

  // A pending Move belongs to the board it started on.
  useEffect(() => { setMoveFrom(null); }, [board.id, editMode]);
  useEffect(() => { if (!editMode) setHideMode(false); }, [editMode]);

  const onCellImpl = (index: number, b: AACButton | null) => {
    if (editMode) {
      if (hideMode) {
        if (b && !b.link && !b.action) {
          updateProfile((pp) => {
            const c = pp.boards[board.id].cells[index];
            if (c) { if (c.hidden) delete c.hidden; else c.hidden = true; }
          }, { undoable: true });
        }
        return;
      }
      if (moveFrom !== null) {
        if (moveFrom !== index) {
          updateProfile((pp) => {
            const cells = pp.boards[board.id].cells;
            [cells[moveFrom], cells[index]] = [cells[index], cells[moveFrom]];
          }, { undoable: true });
        }
        setMoveFrom(null);
        return;
      }
      setEditing({ index, button: b });
      return;
    }
    if (b) pressButton(b);
  };

  // Stable callbacks so memoised cells don't re-render on every tap.
  const cellRef = useRef(onCellImpl);
  cellRef.current = onCellImpl;
  const onCell = useCallback((i: number, b: AACButton | null) => cellRef.current(i, b), []);
  const onLong = useCallback((b: AACButton) => setFormsButton(b), []);

  const saveButton = (nb: AACButton, newBoard?: Board) => {
    if (!editing) return;
    updateProfile((pp) => {
      if (newBoard) pp.boards[newBoard.id] = newBoard;
      pp.boards[board.id].cells[editing.index] = nb;
    }, { undoable: true });
    setEditing(null);
    showToast(newBoard ? 'Folder created — tap it to add words' : 'Saved');
  };

  const deleteButton = () => {
    if (!editing) return;
    updateProfile((pp) => {
      pp.boards[board.id].cells[editing.index] = null;
    }, { undoable: true });
    setEditing(null);
  };

  return (
    <div className="talk">
      {(boardStack.length > 1 || editMode) && (
        <div className="board-title">
          {board.symbol && <Symbol value={board.symbol} />}
          <span>{board.name}</span>
          {editMode && (
            <div className="edit-tools">
              {moveFrom !== null && <span className="hint">{t('Now tap where it should go')}</span>}
              {hideMode && <span className="hint">{t('Tap words to hide or show them')}</span>}
              <button className={`btn small ${hideMode ? 'primary' : ''}`} onClick={() => setHideMode(!hideMode)}><IconEyeOff size={18} /> {hideMode ? t('Done hiding') : t('Show/Hide')}</button>
              {hideMode && board.cells.some((c) => c?.hidden) && (
                <button className="btn small" onClick={() => updateProfile((pp) => {
                  pp.boards[board.id].cells.filter((c) => c?.hidden).slice(0, 5).forEach((c) => { delete c!.hidden; });
                }, { undoable: true })}>{t('Reveal 5 more')}</button>
              )}
              <button className="btn small" onClick={() => setAddingWord(true)}><IconPlus size={18} /> {t('Word')}</button>
              <button className="btn small" onClick={undoEdit} disabled={!undo.length}><IconUndo size={18} /> {t('Undo')}</button>
              <button className="btn small" onClick={() => setNewCat(true)}><IconPlus size={18} /> {t('Category')}</button>
              <button className="btn small" onClick={() => setBoardSettings(true)}><IconSettings size={18} /> {t('Board')}</button>
              <button className="btn small primary" onClick={() => { setEditMode(false); setMoveFrom(null); }}><IconCheck size={18} /> {t('Done')}</button>
            </div>
          )}
        </div>
      )}
      <BoardGrid
        board={board}
        settings={s}
        editMode={editMode}
        highlight={highlight}
        selectedIndex={moveFrom}
        onCell={onCell}
        onLongPress={onLong}
      />
      {editing && (
        <ButtonEditor
          button={editing.button}
          boards={Object.values(p.boards)}
          currentBoardId={board.id}
          defaultCols={board.cols}
          onSave={saveButton}
          onDelete={deleteButton}
          onMove={() => { setMoveFrom(editing.index); setEditing(null); }}
          onOpenFolder={editing.button?.link ? () => { const l = editing.button!.link!; setEditing(null); openBoard(l); } : undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {formsButton && (
        <FormsPopover
          word={formsButton.speak ?? formsButton.label}
          type={formsButton.type}
          symbol={formsButton.symbol}
          explicit={formsButton.forms}
          onClose={() => setFormsButton(null)}
          onPick={(f) => {
            if (formsButton.link || formsButton.action) {
              // A folder's name as a word: just add it (pressing would open the folder).
              const w = formsButton.speak ?? formsButton.label;
              addWord({ text: f, base: f !== w ? w : undefined, symbol: formsButton.symbol, type: formsButton.type });
              if (s.speakOnTap) speakText(f, { echo: true });
            } else {
              // Same path as a tap: usage log, return-home and the base word for later form changes.
              pressButton(formsButton, { form: f });
            }
            setFormsButton(null);
          }}
        />
      )}
      {addingWord && <AddWordDialog boardId={board.id} onClose={() => setAddingWord(false)} />}
      {newCat && <NewCategoryDialog parentBoardId={board.id} onClose={() => setNewCat(false)} />}
      {boardSettings && <BoardSettings board={board} isRoot={board.id === p.rootId} onClose={() => setBoardSettings(false)} />}
      {editMode && boardStack.length === 1 && orphanBoards(p).length > 0 && (
        <p className="orphans muted">{orphanBoards(p).length} folder(s) are not linked from any board. Find them in Grown-ups → Boards.</p>
      )}
    </div>
  );
});

function BoardSettings({ board, isRoot, onClose }: { board: Board; isRoot: boolean; onClose: () => void }) {
  const { updateProfile, back, showToast, undoEdit } = useStore.getState();
  const [name, setName] = useState(board.name);
  const [cols, setCols] = useState(board.cols);
  const [rows, setRows] = useState(board.rows);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { lost } = resizeBoard(board, cols, rows);
  const dirty = name !== board.name || cols !== board.cols || rows !== board.rows;
  const words = board.cells.filter((c) => c && !c.link && !c.action).length;

  const save = () => {
    updateProfile((pp) => {
      const r = resizeBoard(pp.boards[board.id], cols, rows);
      pp.boards[board.id] = { ...r.board, name: name.trim() || board.name };
    }, { undoable: true });
    onClose();
  };

  const remove = () => {
    addSnapshot(useStore.getState().data, 'Before deleting a folder').catch(() => {});
    updateProfile((pp) => {
      delete pp.boards[board.id];
      for (const b of Object.values(pp.boards)) {
        b.cells = b.cells.map((c) => (c?.link === board.id ? null : c));
      }
    }, { undoable: true });
    back();
    showToast(t('Folder deleted'), { label: 'Undo', run: undoEdit });
    onClose();
  };

  const stepper = (label: string, v: number, setV: (n: number) => void, min: number, max: number) => (
    <div className="field">
      <span>{label}</span>
      <div className="stepper">
        <button className="btn" onClick={() => setV(Math.max(min, v - 1))}>−</button>
        <b>{v}</b>
        <button className="btn" onClick={() => setV(Math.min(max, v + 1))}>+</button>
      </div>
    </div>
  );

  return (
    <>
    <Modal title={t('Board settings')} onClose={onClose} dirty={dirty}
      footer={
        <>
          {!isRoot && <button className="btn danger-outline" onClick={() => setConfirmDelete(true)}>{t('Delete folder')}</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" onClick={save}>{t('Save')}</button>
        </>
      }>
      <label className="field"><span>{t('Name')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="row">
        {stepper('Columns', cols, setCols, 1, 12)}
        {stepper('Rows', rows, setRows, 1, 14)}
      </div>
      {lost > 0 && <p className="error">{lost} button(s) would be removed by shrinking. Consider hiding them instead.</p>}
      <p className="muted small">{t('Buttons keep their row and column when you resize, so the motor plan stays the same.')}</p>
    </Modal>
    {confirmDelete && (
      <ConfirmDialog title={t('Delete the folder “{v0}”?', { v0: board.name })} confirmLabel={t('Delete folder')}
        onClose={() => setConfirmDelete(false)} onConfirm={remove}>
        <p>{t('This removes the folder and its {v0} word(s) from every board. You can press Undo straight after, and a backup copy is kept.', { v0: words })}</p>
      </ConfirmDialog>
    )}
    </>
  );
}
