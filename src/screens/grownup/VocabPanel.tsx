import { useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Choice, Section, Toggle } from './controls';
import { boardPaths } from '../../lib/boards';
import { Symbol } from '../../components/Symbol';
import { Modal } from '../../components/Modal';
import { buildProfile } from '../../data/defaults';
import { uid } from '../../lib/util';
import type { LayoutId } from '../../types';
import { IconEdit, IconPlus } from '../../components/Icons';
import { printBoards } from '../../lib/print';
import { NewCategoryDialog } from '../../components/NewCategoryDialog';
import { t, type Lang } from '../../i18n';
import { addSnapshot } from '../../lib/db';
import { applyStarterWords } from '../../lib/starter';

export const LAYOUTS: { id: LayoutId; name: string; desc: string }[] = [
  { id: 'big', name: 'Big buttons · 12', desc: '4 × 3 grid. Beginners, or harder motor access.' },
  { id: 'compact', name: 'Phone core · 30', desc: '5 × 6 grid shaped for phones held upright.' },
  { id: 'medium', name: 'Medium · 30', desc: '6 × 5 grid. Good starting point for most people.' },
  { id: 'full', name: 'Full core · 48', desc: '8 × 6 grid with Universal Core words. Tablets; lots of room to grow.' },
];

export function VocabPanel({ onDone }: { onDone: () => void }) {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings, updateProfile, openBoard, setEditMode, home, showToast } = useStore.getState();
  const [confirmLayout, setConfirmLayout] = useState<LayoutId | null>(null);
  const [printSel, setPrintSel] = useState<string[] | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [printing, setPrinting] = useState(false);
  const paths = boardPaths(p);
  const boards = Object.values(p.boards).sort((a, b) => (paths[a.id]?.length ?? 99) - (paths[b.id]?.length ?? 99) || a.name.localeCompare(b.name));

  const editBoard = (id: string) => {
    home();
    if (id !== p.rootId) {
      for (const bid of (paths[id] ?? [p.rootId, id]).slice(1)) openBoard(bid);
    }
    setEditMode(true);
    onDone();
  };

  const newBoard = () => {
    const id = uid('board-');
    const cols = p.boards[p.rootId].cols;
    updateProfile((pp) => {
      pp.boards[id] = { id, name: t('New board'), cols, rows: 4, cells: Array(cols * 4).fill(null) };
      // Link it from the More board if there is room, else from home's first empty cell.
      const target = pp.boards.more ?? pp.boards[pp.rootId];
      const idx = target.cells.findIndex((c) => !c);
      const btn = { id: uid('b'), label: t('New board'), type: 'folder' as const, link: id };
      if (idx >= 0) target.cells[idx] = btn;
      else { target.rows += 1; target.cells.push(btn, ...Array(target.cols - 1).fill(null)); }
    }, { undoable: true });
    showToast(t('Board created and linked from “More”'));
    editBoard(id);
  };

  const applyLayout = async (layout: LayoutId) => {
    setConfirmLayout(null);
    const before = useStore.getState().profile();
    // Keep a snapshot first (the dialog promises one); never change the layout without it.
    try { await addSnapshot(useStore.getState().data, 'Before changing layout'); } catch (e) {
      showToast(t('Could not save a snapshot, so the layout was not changed.'));
      console.warn('snapshot failed', e);
      return;
    }
    // Built in the profile's own language, so a Spanish profile gets Spanish boards.
    const fresh = buildProfile(before.name, layout, (before.settings.language ?? 'en') as Lang);
    updateProfile((pp) => {
      pp.layout = layout;
      pp.boards = fresh.boards;
      pp.rootId = fresh.rootId;
    }, { undoable: true });
    home();
    showToast(t('Layout changed. A snapshot was saved first.'), {
      label: 'Undo',
      run: () => {
        const st = useStore.getState();
        // Normally the last undo step is this change; if not, put the old boards back directly.
        if (st.undo[st.undo.length - 1]?.boards === before.boards) st.undoEdit();
        else st.updateProfile((pp) => { pp.layout = before.layout; pp.boards = before.boards; pp.rootId = before.rootId; }, { undoable: true });
        st.home();
      },
    });
  };

  return (
    <>
      <Section title={t('Edit boards')} intro={t('Tap “Edit” on any board, then tap a button to change it. Tap an empty square to add a word. Hide words (instead of deleting) to keep the motor plan stable.')}>
        <div className="row">
          <button className="btn primary" onClick={() => editBoard(p.rootId)}><IconEdit /> {t('Edit Home board')}</button>
          <button className="btn" onClick={() => setNewCat(true)}><IconPlus /> {t('New category')}</button>
          <button className="btn" onClick={newBoard}>{t('Blank board')}</button>
        </div>
        <div className="board-list">
          {boards.map((b) => (
            <div key={b.id} className="board-row">
              {b.symbol ? <Symbol value={b.symbol} /> : <span className="sym" />}
              <span className="grow">
                <b>{b.name}</b>
                <small>{b.cols}×{b.rows} · {t('{n} buttons', { n: b.cells.filter(Boolean).length })}{b.cells.some((c) => c?.hidden) ? ` · ${t('{n} hidden', { n: b.cells.filter((c) => c?.hidden).length })}` : ''}{!paths[b.id] ? ` · ${t('not linked')}` : ''}</small>
              </span>
              <button className="btn small" onClick={() => editBoard(b.id)}>{t('Edit')}</button>
            </div>
          ))}
        </div>
      </Section>
      <Section title={t('Grow vocabulary over time')} intro={t('AAC best practice: keep every word in its place and reveal more as the person is ready. Starter mode hides all but about 12 to 20 key words on Home, plus all folders. Nothing moves, and hidden words leave a gap. Reveal words one at a time in edit mode, or all at once here.')}>
        <div className="row">
          <button className="btn" onClick={() => {
            updateProfile((pp) => applyStarterWords(pp.boards[pp.rootId]), { undoable: true });
            showToast(t('Starter words only. Other words are hidden but keep their places.'));
          }}>{t('Starter words only')}</button>
          <button className="btn" onClick={() => {
            updateProfile((pp) => { for (const b of Object.values(pp.boards)) b.cells.forEach((c) => { if (c) delete c.hidden; }); }, { undoable: true });
            showToast(t('All words are showing'));
          }}>{t('Show all words')}</button>
        </div>
        <p className="muted small">{t('Words hidden right now: {n}. Babble mode (Display) shows them for a while.', { n: Object.values(p.boards).reduce((n, b) => n + b.cells.filter((c) => c?.hidden).length, 0) })}</p>
      </Section>
      <Section title={t('Paper boards')} intro={t('Print a low-tech backup for bath time, the pool, a flat battery or a broken screen. It includes the quick bar on every page.')}>
        <button className="btn" onClick={() => setPrintSel([p.rootId, ...(p.boards[p.rootId]?.cells.filter((c) => c?.link).map((c) => c!.link!) ?? [])])}>{t('Print boards…')}</button>
      </Section>
      <Section title={t('Home layout')} intro={t('Changing the layout replaces all boards with the built-in vocabulary (your phrases, schedules and settings stay). A backup snapshot is kept.')}>
        <div className="layout-cards">
          {LAYOUTS.map((l) => (
            <button key={l.id} className={`layout-card ${p.layout === l.id ? 'on' : ''}`} onClick={() => p.layout !== l.id && setConfirmLayout(l.id)}>
              <LayoutThumb id={l.id} />
              <b>{t(l.name)}</b>
              <small>{t(l.desc)}</small>
            </button>
          ))}
        </div>
      </Section>
      <Section title={t('Keyboard')}>
        <Choice label={t('Letter layout')} value={s.keyboardLayout} onChange={(keyboardLayout) => updateSettings({ keyboardLayout })}
          options={[{ value: 'qwerty', label: 'QWERTY' }, { value: 'azerty', label: 'AZERTY' }, { value: 'abc', label: 'ABC' }]} />
        <Toggle label={t('Learn from what is typed and said')} hint={t("Improves word prediction using this person's own words. Stays on this device. Off by default.")} checked={s.learnWords} onChange={(learnWords) => updateSettings({ learnWords })} />
        {Object.keys(p.lexicon).length > 0 && (
          <button className="btn small" onClick={() => updateProfile((pp) => { pp.lexicon = {}; })}>{t('Forget learned words ({n})', { n: Object.keys(p.lexicon).length })}</button>
        )}
      </Section>
      {newCat && <NewCategoryDialog parentBoardId={p.rootId} onClose={() => setNewCat(false)} onCreated={(id) => editBoard(id)} />}
      {printSel && (
        <Modal title={t('Print boards')} onClose={() => setPrintSel(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setPrintSel(null)}>{t('Cancel')}</button>
            <button className="btn primary" disabled={!printSel.length || printing} onClick={async () => {
              setPrinting(true);
              try { showToast(await printBoards(p, boards.map((b) => b.id).filter((id) => printSel.includes(id)))); } finally { setPrinting(false); setPrintSel(null); }
            }}>{printing ? t('Preparing…') : t('Print boards: {n}', { n: printSel.length })}</button></>}>
          <div className="print-pick">
            {boards.map((b) => (
              <label key={b.id} className="check">
                <input type="checkbox" checked={printSel.includes(b.id)} onChange={(e) => setPrintSel(e.target.checked ? [...printSel, b.id] : printSel.filter((x) => x !== b.id))} />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
          <p className="muted small">{t('On Android the boards are saved as a web page. Open it in Chrome and choose Print, or send it to a computer.')}</p>
        </Modal>
      )}
      {confirmLayout && (
        <Modal title={t('Change layout?')} onClose={() => setConfirmLayout(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirmLayout(null)}>{t('Cancel')}</button><button className="btn primary" onClick={() => applyLayout(confirmLayout)}>{t('Change layout')}</button></>}>
          <p>{t('This replaces the boards with the built-in “{layout}” vocabulary. Any buttons you added or changed on boards will be replaced.', { layout: t(LAYOUTS.find((l) => l.id === confirmLayout)!.name) })}</p>
          <p className="muted">{t('Changing layouts changes where words are, which means relearning motor plans. Try to pick one and grow into it by un-hiding words over time.')}</p>
        </Modal>
      )}
    </>
  );
}

export function LayoutThumb({ id }: { id: LayoutId }) {
  const dims = { big: [4, 3], compact: [5, 6], medium: [6, 5], full: [8, 6] }[id];
  const colors = ['#fff1a8', '#c5efb4', '#c5efb4', '#c4dcff', '#e3d1ff', '#ffd8b0', '#efe3cf', '#efe3cf'];
  return (
    <span className="layout-thumb" style={{ gridTemplateColumns: `repeat(${dims[0]}, 1fr)` }}>
      {Array.from({ length: dims[0] * dims[1] }, (_, i) => {
        const c = i % dims[0];
        const col = c === dims[0] - 1 ? colors[7] : colors[Math.min(6, Math.floor((c / (dims[0] - 1)) * 6))];
        return <i key={i} style={{ background: col }} />;
      })}
    </span>
  );
}
