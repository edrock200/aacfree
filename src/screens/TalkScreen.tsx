import { useState } from 'react';
import { useStore, useProfile } from '../store';
import { BoardGrid } from '../components/BoardGrid';
import { ButtonEditor } from '../components/ButtonEditor';
import { FormsPopover } from '../components/FormsPopover';
import { Modal } from '../components/Modal';
import { Symbol } from '../components/Symbol';
import { resizeBoard, orphanBoards } from '../lib/boards';
import type { AACButton, Board } from '../types';
import { IconCheck, IconEye, IconEyeOff, IconSettings, IconUndo } from '../components/Icons';

export function TalkScreen() {
  const p = useProfile();
  const s = p.settings;
  const boardStack = useStore((st) => st.boardStack);
  const editMode = useStore((st) => st.editMode);
  const highlight = useStore((st) => st.highlight);
  const undo = useStore((st) => st.undo);
  const { pressButton, updateProfile, undoEdit, setEditMode, addWord, speakText, showToast, updateSettings } = useStore.getState();

  const boardId = boardStack[boardStack.length - 1];
  const board = p.boards[boardId] ?? p.boards[p.rootId];
  const [editing, setEditing] = useState<{ index: number; button: AACButton | null } | null>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  const [formsButton, setFormsButton] = useState<AACButton | null>(null);
  const [boardSettings, setBoardSettings] = useState(false);

  const onCell = (index: number, b: AACButton | null) => {
    if (editMode) {
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
              {moveFrom !== null && <span className="hint">Now tap where it should go</span>}
              <button className="btn small" onClick={undoEdit} disabled={!undo.length}><IconUndo size={18} /> Undo</button>
              <button className="btn small" onClick={() => updateSettings({ babble: !s.babble })}>
                {s.babble ? <IconEye size={18} /> : <IconEyeOff size={18} />} {s.babble ? 'Showing hidden' : 'Hidden masked'}
              </button>
              <button className="btn small" onClick={() => setBoardSettings(true)}><IconSettings size={18} /> Board</button>
              <button className="btn small primary" onClick={() => { setEditMode(false); setMoveFrom(null); }}><IconCheck size={18} /> Done</button>
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
        onLongPress={(b) => setFormsButton(b)}
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
            addWord({ text: f, symbol: formsButton.symbol, type: formsButton.type });
            if (s.speakOnTap) speakText(f);
            setFormsButton(null);
          }}
        />
      )}
      {boardSettings && <BoardSettings board={board} isRoot={board.id === p.rootId} onClose={() => setBoardSettings(false)} />}
      {editMode && boardStack.length === 1 && orphanBoards(p).length > 0 && (
        <p className="orphans muted">{orphanBoards(p).length} folder(s) are not linked from any board. Find them in Grown-ups → Boards.</p>
      )}
    </div>
  );
}

function BoardSettings({ board, isRoot, onClose }: { board: Board; isRoot: boolean; onClose: () => void }) {
  const { updateProfile, back, showToast } = useStore.getState();
  const [name, setName] = useState(board.name);
  const [cols, setCols] = useState(board.cols);
  const [rows, setRows] = useState(board.rows);
  const { lost } = resizeBoard(board, cols, rows);

  const save = () => {
    updateProfile((pp) => {
      const r = resizeBoard(pp.boards[board.id], cols, rows);
      pp.boards[board.id] = { ...r.board, name: name.trim() || board.name };
    }, { undoable: true });
    onClose();
  };

  const remove = () => {
    updateProfile((pp) => {
      delete pp.boards[board.id];
      for (const b of Object.values(pp.boards)) {
        b.cells = b.cells.map((c) => (c?.link === board.id ? null : c));
      }
    }, { undoable: true });
    back();
    showToast('Folder deleted (Undo is available)');
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
    <Modal title="Board settings" onClose={onClose}
      footer={
        <>
          {!isRoot && <button className="btn danger-outline" onClick={remove}>Delete folder</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </>
      }>
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="row">
        {stepper('Columns', cols, setCols, 1, 12)}
        {stepper('Rows', rows, setRows, 1, 14)}
      </div>
      {lost > 0 && <p className="error">{lost} button(s) would be removed by shrinking. Consider hiding them instead.</p>}
      <p className="muted small">Buttons keep their row and column when you resize, so the motor plan stays the same.</p>
    </Modal>
  );
}
