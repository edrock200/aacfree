import { useState } from 'react';
import type { AACButton, Board, WordType } from '../types';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { SymbolPicker } from './SymbolPicker';
import { AudioRecorder } from './AudioRecorder';
import { COLOR_SWATCHES, WORD_COLORS } from '../lib/colors';
import { searchBundled } from '../data/defaults';
import { uid } from '../lib/util';
import { IconEyeOff, IconMove, IconTrash } from './Icons';
import { formsFor } from '../lib/morphology';
import { useStore } from '../store';
import { t } from '../i18n';

interface Props {
  button: AACButton | null;
  boards: Board[];
  currentBoardId?: string;
  allowFolder?: boolean;
  onSave: (b: AACButton, newBoard?: Board) => void;
  onDelete?: () => void;
  onMove?: () => void;
  onOpenFolder?: () => void;
  onClose: () => void;
  defaultCols?: number;
}

type Kind = 'word' | 'folder' | 'speak';

export function ButtonEditor({ button, boards, currentBoardId, allowFolder = true, onSave, onDelete, onMove, onOpenFolder, onClose, defaultCols = 6 }: Props) {
  const [b, setB] = useState<AACButton>(() => button ? { ...button } : { id: uid('b'), label: '', type: 'noun' });
  const [kind, setKind] = useState<Kind>(button?.link ? 'folder' : button?.speakOnly ? 'speak' : 'word');
  const [picking, setPicking] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formsText, setFormsText] = useState(button?.forms?.join(', ') ?? '');
  const [copying, setCopying] = useState(false);

  /** Put a copy of this button in the first free square of another board (adds a row if full). */
  const copyTo = (boardId: string) => {
    const { updateProfile, showToast } = useStore.getState();
    updateProfile((pp) => {
      const target = pp.boards[boardId];
      if (!target) return;
      const clone: AACButton = { ...b, id: uid('b'), hidden: undefined };
      const idx = target.cells.findIndex((c) => !c);
      if (idx >= 0) target.cells[idx] = clone;
      else {
        target.rows += 1;
        target.cells.push(clone, ...Array(target.cols - 1).fill(null));
      }
    }, { undoable: true });
    setCopying(false);
    showToast(t('Copied to “{v0}”', { v0: boards.find((x) => x.id === boardId)?.name }));
  };

  const set = (patch: Partial<AACButton>) => setB((x) => ({ ...x, ...patch }));

  // Suggest a symbol automatically as the label is typed (new buttons only).
  const onLabel = (label: string) => {
    const patch: Partial<AACButton> = { label };
    if (!button && (!b.symbol || b.symbol.startsWith('a:'))) {
      const hit = searchBundled(label, 1)[0];
      if (hit && hit.keyword === label.trim().toLowerCase()) patch.symbol = hit.symbol;
    }
    set(patch);
  };

  const save = () => {
    if (!b.label.trim()) return;
    const out: AACButton = { ...b, label: b.label.trim() };
    if (!out.speak?.trim() || out.speak.trim() === out.label) delete out.speak;
    out.speakOnly = kind === 'speak' || undefined;
    const forms = formsText.split(',').map((x) => x.trim()).filter(Boolean);
    out.forms = forms.length ? forms : undefined;
    let nb: Board | undefined;
    if (kind === 'folder') {
      out.type = 'folder';
      if (newFolder || !out.link) {
        const id = uid('board-');
        nb = { id, name: out.label, cols: defaultCols, rows: 4, cells: Array(defaultCols * 4).fill(null), symbol: out.symbol };
        out.link = id;
      }
    } else {
      delete out.link;
      if (out.type === 'folder') out.type = 'noun';
    }
    onSave(out, nb);
  };

  const otherBoards = boards.filter((x) => x.id !== currentBoardId);
  const autoForms = formsFor(b.label, b.type);

  return (
    <>
      <Modal
        title={button ? 'Edit button' : 'New button'}
        onClose={onClose}
        wide
        footer={
          <>
            {onOpenFolder && <button className="btn primary" onClick={onOpenFolder}>{t('Open folder →')}</button>}
            {button && onMove && <button className="btn" onClick={onMove}><IconMove /> {t('Move')}</button>}
            {button && boards.length > 1 && <button className="btn" onClick={() => setCopying(true)}>{t('Copy to…')}</button>}
            {button && onDelete && <button className="btn danger-outline" onClick={() => setConfirmDelete(true)}><IconTrash /> {t('Delete')}</button>}
            <span className="spacer" />
            <button className="btn" onClick={onClose}>{t('Cancel')}</button>
            <button className="btn primary" onClick={save} disabled={!b.label.trim()}>{t('Save')}</button>
          </>
        }
      >
        <div className="editor">
          <div className="editor-preview">
            <button className="cell preview" style={{ background: b.color ?? WORD_COLORS[kind === 'folder' ? 'folder' : b.type].light }} onClick={() => setPicking(true)}>
              {b.symbol ? <Symbol value={b.symbol} /> : <span className="muted">{t('Tap to add picture')}</span>}
              <span className="cell-label">{b.label || 'Label'}</span>
            </button>
            <button className="btn small" onClick={() => setPicking(true)}>{t('Change picture')}</button>
          </div>
          <div className="editor-fields">
            <label className="field">
              <span>{t('Label')}</span>
              <input autoFocus={!button} value={b.label} onChange={(e) => onLabel(e.target.value)} placeholder={t('e.g. trampoline')} />
            </label>
            <div className="field">
              <span>{t('What it does')}</span>
              <div className="seg">
                <button className={kind === 'word' ? 'on' : ''} onClick={() => setKind('word')}>{t('Adds word')}</button>
                {allowFolder && <button className={kind === 'folder' ? 'on' : ''} onClick={() => setKind('folder')}>{t('Opens folder')}</button>}
                <button className={kind === 'speak' ? 'on' : ''} onClick={() => setKind('speak')}>{t('Speaks right away')}</button>
              </div>
            </div>
            {kind === 'folder' && (
              <label className="field">
                <span>{t('Folder to open')}</span>
                <select
                  value={newFolder ? '__new' : b.link ?? '__new'}
                  onChange={(e) => {
                    if (e.target.value === '__new') { setNewFolder(true); set({ link: undefined }); }
                    else { setNewFolder(false); set({ link: e.target.value }); }
                  }}
                >
                  <option value="__new">+ New empty folder called “{b.label || '…'}”</option>
                  {otherBoards.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
            )}
            {kind !== 'folder' && (
              <label className="field">
                <span>{t('Say something different')} <small>(optional)</small></span>
                <input value={b.speak ?? ''} onChange={(e) => set({ speak: e.target.value })} placeholder={b.label ? `Says “${b.label}”` : 'Spoken text'} />
              </label>
            )}
            {kind !== 'folder' && (
              <div className="field">
                <span>{t('Word type (colour)')}</span>
                <div className="types">
                  {(Object.keys(WORD_COLORS) as WordType[]).filter((w) => w !== 'folder').map((w) => (
                    <button key={w} className={`type-chip ${b.type === w ? 'on' : ''}`} style={{ background: WORD_COLORS[w].light }} onClick={() => set({ type: w })}>
                      {t(WORD_COLORS[w].name)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <span>{t('Custom colour')} <small>(optional)</small></span>
              <div className="swatches">
                <button className={`swatch none ${!b.color ? 'on' : ''}`} onClick={() => set({ color: undefined })} aria-label={t('Automatic colour')}>A</button>
                {COLOR_SWATCHES.map((c) => (
                  <button key={c} className={`swatch ${b.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={c} />
                ))}
              </div>
            </div>
            {kind !== 'folder' && (
              <div className="field">
                <span>{t('Recorded voice')} <small>(plays instead of the computer voice)</small></span>
                <AudioRecorder value={b.audio} onChange={(audio) => set({ audio })} />
              </div>
            )}
            {kind === 'word' && (
              <label className="field">
                <span>{t('Word forms')} <small>(comma separated, optional)</small></span>
                <input value={formsText} onChange={(e) => setFormsText(e.target.value)} placeholder={autoForms.slice(0, 4).join(', ') || 'e.g. went, going'} />
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={!!b.hidden} onChange={(e) => set({ hidden: e.target.checked || undefined })} />
              <span><IconEyeOff size={18} /> {t('Hide from the user for now')} <small>(keeps its place, so the motor plan stays the same)</small></span>
            </label>
          </div>
        </div>
      </Modal>
      {picking && (
        <SymbolPicker
          initialQuery={b.label}
          onClose={() => setPicking(false)}
          onPick={(symbol, label) => { set(b.label.trim() || !label ? { symbol } : { symbol, label }); setPicking(false); }}
        />
      )}
      {copying && (
        <Modal title={t('Copy to which board?')} onClose={() => setCopying(false)}>
          <div className="copy-list">
            {otherBoards.map((x) => (
              <button key={x.id} className="find-row" onClick={() => copyTo(x.id)}>
                {x.symbol ? <Symbol value={x.symbol} /> : <span className="sym" />}
                <span className="grow"><b>{x.name}</b><small>{x.cells.filter((c) => !c).length} free squares</small></span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={t('Delete this button?')} onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn" onClick={() => { set({ hidden: true }); setConfirmDelete(false); }}>{t('Hide instead')}</button>
              <span className="spacer" />
              <button className="btn" onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button>
              <button className="btn danger" onClick={onDelete}>{t('Delete')}</button>
            </>
          }>
          <p>{t('AAC tip:')} <b>{t('hiding')}</b> a word keeps its spot, so the person's muscle memory still works when it comes back. Deleting removes it for good (you can still undo).</p>
        </Modal>
      )}
    </>
  );
}
