import { useState } from 'react';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { useStore, useProfile } from '../store';
import { findWord } from '../lib/boards';
import { IconSearch } from './Icons';
import { AddWordDialog } from './AddWordDialog';
import { t } from '../i18n';

/**
 * "Where is that word?" — shows the path to a word and highlights each
 * button to tap. Great for modelling (aided language input) too.
 */
export function FindWord({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [q, setQ] = useState('');
  const results = findWord(p, q);
  const { home, openBoard, setHighlight, speakText, addText, updateProfile } = useStore.getState();
  const unlocked = useStore((st) => st.unlocked);
  const [adding, setAdding] = useState(false);

  const go = (path: string[], ids: string[], target: string) => {
    home();
    setHighlight([...ids, target]);
    onClose();
    // Walk the path one step at a time so the person sees the motor plan.
    path.slice(1).forEach((bid, i) => setTimeout(() => openBoard(bid), 1100 * (i + 1)));
    setTimeout(() => setHighlight([]), 1100 * path.length + 3500);
  };

  return (
    <Modal title={t('Find a word')} onClose={onClose} wide>
      <label className="search">
        <IconSearch size={20} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Type a word…')} />
      </label>
      <ul className="find-results">
        {results.map((r) => (
          <li key={r.button.id + r.boardId}>
            <button className="find-row" onClick={() => go(r.path, r.folderButtonIds, r.button.id)}>
              <Symbol value={r.button.symbol} />
              <span className="grow">
                <b>{r.button.label}</b>
                <small>{r.path.map((id) => p.boards[id]?.name).join(' › ')}{r.button.hidden ? ' · hidden for now' : ''}</small>
              </span>
              <span className="chip">{t('Show me')}</span>
            </button>
            {r.button.hidden && unlocked && (
              <button className="btn small" onClick={() => updateProfile((pp) => {
                const c = pp.boards[r.boardId].cells.find((x) => x?.id === r.button.id);
                if (c) delete c.hidden;
              }, { undoable: true })}>{t('Reveal')}</button>
            )}
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 && (
        <div className="find-miss">
          <p className="muted">“{q.trim()}” isn't on a board yet.</p>
          <div className="row">
            <button className="btn primary" onClick={() => speakText(q.trim())}>{t('Say it')}</button>
            <button className="btn" onClick={() => { addText(q.trim()); onClose(); }}>{t('Put in message')}</button>
            {unlocked && <button className="btn" onClick={() => setAdding(true)}>{t('Add to a board…')}</button>}
          </div>
        </div>
      )}
      {adding && <AddWordDialog initialWord={q.trim()} onClose={() => { setAdding(false); onClose(); }} />}
    </Modal>
  );
}
