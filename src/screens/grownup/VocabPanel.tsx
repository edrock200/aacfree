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

export const LAYOUTS: { id: LayoutId; name: string; desc: string }[] = [
  { id: 'big', name: 'Big buttons · 12', desc: '4 × 3 grid. Beginners, phones, or harder motor access.' },
  { id: 'medium', name: 'Medium · 30', desc: '6 × 5 grid. Good starting point for most people.' },
  { id: 'full', name: 'Full core · 48', desc: '8 × 6 grid with Universal Core words. Tablets; lots of room to grow.' },
];

export function VocabPanel({ onDone }: { onDone: () => void }) {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings, updateProfile, openBoard, setEditMode, home, showToast } = useStore.getState();
  const [confirmLayout, setConfirmLayout] = useState<LayoutId | null>(null);
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
      pp.boards[id] = { id, name: 'New board', cols, rows: 4, cells: Array(cols * 4).fill(null) };
      // Link it from the More board if there is room, else from home's first empty cell.
      const target = pp.boards.more ?? pp.boards[pp.rootId];
      const idx = target.cells.findIndex((c) => !c);
      const btn = { id: uid('b'), label: 'New board', type: 'folder' as const, link: id };
      if (idx >= 0) target.cells[idx] = btn;
      else { target.rows += 1; target.cells.push(btn, ...Array(target.cols - 1).fill(null)); }
    }, { undoable: true });
    showToast('Board created and linked from “More”');
    editBoard(id);
  };

  const applyLayout = (layout: LayoutId) => {
    const fresh = buildProfile(p.name, layout);
    updateProfile((pp) => {
      pp.layout = layout;
      pp.boards = fresh.boards;
      pp.rootId = fresh.rootId;
    }, { undoable: true });
    home();
    setConfirmLayout(null);
    showToast('Layout changed. Undo is available in edit mode.');
  };

  return (
    <>
      <Section title="Edit boards" intro="Tap “Edit” on any board, then tap a button to change it. Tap an empty square to add a word. Hide words (instead of deleting) to keep the motor plan stable.">
        <div className="row">
          <button className="btn primary" onClick={() => editBoard(p.rootId)}><IconEdit /> Edit Home board</button>
          <button className="btn" onClick={newBoard}><IconPlus /> New board</button>
        </div>
        <div className="board-list">
          {boards.map((b) => (
            <div key={b.id} className="board-row">
              {b.symbol ? <Symbol value={b.symbol} /> : <span className="sym" />}
              <span className="grow">
                <b>{b.name}</b>
                <small>{b.cols}×{b.rows} · {b.cells.filter(Boolean).length} buttons{b.cells.some((c) => c?.hidden) ? ` · ${b.cells.filter((c) => c?.hidden).length} hidden` : ''}{!paths[b.id] ? ' · not linked' : ''}</small>
              </span>
              <button className="btn small" onClick={() => editBoard(b.id)}>Edit</button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Home layout" intro="Changing the layout replaces all boards with the built-in vocabulary (your phrases, schedules and settings stay). A backup snapshot is kept.">
        <div className="layout-cards">
          {LAYOUTS.map((l) => (
            <button key={l.id} className={`layout-card ${p.layout === l.id ? 'on' : ''}`} onClick={() => p.layout !== l.id && setConfirmLayout(l.id)}>
              <LayoutThumb id={l.id} />
              <b>{l.name}</b>
              <small>{l.desc}</small>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Keyboard">
        <Choice label="Letter layout" value={s.keyboardLayout} onChange={(keyboardLayout) => updateSettings({ keyboardLayout })}
          options={[{ value: 'qwerty', label: 'QWERTY' }, { value: 'abc', label: 'ABC' }]} />
        <Toggle label="Learn from what is typed and said" hint="Improves word prediction using this person's own words. Stays on this device. Off by default." checked={s.learnWords} onChange={(learnWords) => updateSettings({ learnWords })} />
        {Object.keys(p.lexicon).length > 0 && (
          <button className="btn small" onClick={() => updateProfile((pp) => { pp.lexicon = {}; })}>Forget learned words ({Object.keys(p.lexicon).length})</button>
        )}
      </Section>
      {confirmLayout && (
        <Modal title="Change layout?" onClose={() => setConfirmLayout(null)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirmLayout(null)}>Cancel</button><button className="btn primary" onClick={() => applyLayout(confirmLayout)}>Change layout</button></>}>
          <p>This replaces the boards with the built-in <b>{LAYOUTS.find((l) => l.id === confirmLayout)!.name}</b> vocabulary. Any buttons you added or changed on boards will be replaced.</p>
          <p className="muted">Changing layouts changes where words are, which means relearning motor plans. Try to pick one and grow into it by un-hiding words over time.</p>
        </Modal>
      )}
    </>
  );
}

export function LayoutThumb({ id }: { id: LayoutId }) {
  const dims = { big: [4, 3], medium: [6, 5], full: [8, 6] }[id];
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
