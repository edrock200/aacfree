import { useMemo, useState } from 'react';
import { useStore, useProfile } from '../store';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { SymbolPicker } from './SymbolPicker';
import { suggestSymbol } from '../lib/library';
import { boardPaths } from '../lib/boards';
import { uid } from '../lib/util';
import type { AACButton, WordType } from '../types';
import { t } from '../i18n';

/**
 * Quickest way to add a word: type it, a picture is suggested, pick a board.
 * Goes in the first empty square; if the board is full a row is added at the
 * bottom, so existing buttons never move.
 */
export function AddWordDialog({ initialWord = '', boardId, onClose }: { initialWord?: string; boardId?: string; onClose: () => void }) {
  const p = useProfile();
  const library = useStore((s) => s.data.library);
  const { updateProfile, showToast } = useStore.getState();
  const [word, setWord] = useState(initialWord);
  const [target, setTarget] = useState(boardId ?? p.rootId);
  const [chosen, setChosen] = useState<{ symbol?: string; type?: WordType } | null>(null);
  const [picking, setPicking] = useState(false);
  const paths = useMemo(() => boardPaths(p), [p]);
  const boards = Object.values(p.boards).sort((a, b) => (paths[a.id]?.length ?? 99) - (paths[b.id]?.length ?? 99) || a.name.localeCompare(b.name));

  const suggestion = useMemo(() => suggestSymbol(library, word), [word, library]);
  const pic = chosen ?? suggestion;
  const board = p.boards[target];
  const free = board?.cells.filter((c) => !c).length ?? 0;

  const add = () => {
    const label = word.trim();
    if (!label || !board) return;
    const btn: AACButton = { id: uid('b'), label, type: pic?.type ?? 'noun', symbol: pic?.symbol };
    updateProfile((pp) => {
      const b = pp.boards[target];
      const i = b.cells.findIndex((c) => !c);
      if (i >= 0) b.cells[i] = btn;
      else { b.rows += 1; b.cells.push(btn, ...Array(b.cols - 1).fill(null)); }
    }, { undoable: true });
    showToast(t('Added “{v0}” to {v1}', { v0: label, v1: board.name }));
    onClose();
  };

  return (
    <>
      <Modal title={t('Add a word')} onClose={onClose}
        footer={<><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!word.trim()} onClick={add}>{t('Add word')}</button></>}>
        <div className="cat-editor">
          <button className="sym-opt preview" onClick={() => setPicking(true)} aria-label={t('Choose picture')}>
            {pic?.symbol ? <Symbol value={pic.symbol} /> : <span className="muted">{t('No picture yet')}</span>}
            <span>{pic?.symbol ? t('Change picture') : t('Add picture')}</span>
          </button>
          <div className="grow">
            <label className="field"><span>{t('Word')}</span>
              <input autoFocus value={word} onChange={(e) => { setWord(e.target.value); setChosen(null); }} placeholder={t('e.g. grandma, trampoline')} />
            </label>
            <label className="field"><span>{t('Put it on')}</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name} ({t('{n} free', { n: b.cells.filter((c) => !c).length })})</option>)}
              </select>
            </label>
            <p className="muted small">{free > 0 ? t('It goes in the first empty square.') : t('This board is full, so a new row is added at the bottom. Nothing else moves.')}</p>
          </div>
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={word} onClose={() => setPicking(false)} onPick={(symbol, label) => { setChosen({ symbol }); if (!word.trim() && label) setWord(label); setPicking(false); }} />}
    </>
  );
}
