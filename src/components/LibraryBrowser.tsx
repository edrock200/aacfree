import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { allCategories, searchLibrary, type ViewCategory } from '../lib/library';
import type { LibrarySymbol, WordType } from '../types';
import { Symbol } from './Symbol';
import { Modal } from './Modal';
import { SymbolPicker } from './SymbolPicker';
import { IconBack, IconEdit, IconPlus, IconSearch, IconTrash } from './Icons';
import { uid } from '../lib/util';
import { WORD_COLORS } from '../lib/colors';
import { t } from '../i18n';

interface Props {
  mode: 'pick' | 'manage';
  onPick?: (s: LibrarySymbol) => void;
  initialQuery?: string;
}

/**
 * The symbol library: category folders (each with an icon) that open to show
 * their symbols. Families can add their own categories and symbols.
 */
export function LibraryBrowser({ mode, onPick, initialQuery = '' }: Props) {
  const library = useStore((s) => s.data.library);
  const cats = useMemo(() => allCategories(library), [library]);
  const [q, setQ] = useState(initialQuery);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<ViewCategory | 'new' | null>(null);
  const [editSym, setEditSym] = useState<{ cat: ViewCategory; sym: LibrarySymbol | null } | null>(null);
  const open = cats.find((c) => c.id === openId) ?? null;
  const results = useMemo(() => (q.trim() ? searchLibrary(library, q) : []), [library, q]);

  const tapSymbol = (cat: ViewCategory | null, s: LibrarySymbol) => {
    if (mode === 'pick') return onPick?.(s);
    if (cat && cat.customIds.has(s.id)) setEditSym({ cat, sym: s });
  };

  return (
    <div className="library">
      <label className="search">
        <IconSearch size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search all pictures…')} aria-label={t('Search pictures')} />
      </label>

      {q.trim() ? (
        <>
          <div className="sym-grid">
            {results.map((s) => (
              <button key={s.id + s.symbol} className="sym-opt" onClick={() => tapSymbol(null, s)} title={s.label}>
                <Symbol value={s.symbol} lazy />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          {!results.length && <p className="muted">{t('No matching pictures. Try different words, or the “Online” or “Photo” tab.')}</p>}
        </>
      ) : !open ? (
        <div className="lib-folders">
          {mode === 'manage' && (
            <button className="lib-folder add" onClick={() => setEditCat('new')}>
              <IconPlus size={40} />
              <b>{t('New category')}</b>
            </button>
          )}
          {cats.map((c) => (
            <button key={c.id} className={`lib-folder ${c.builtIn ? '' : 'custom'}`} onClick={() => setOpenId(c.id)} aria-label={`${c.name} folder`}>
              <span className="lib-folder-icon">{c.icon ? <Symbol value={c.icon} lazy /> : <span className="lib-folder-blank">{c.name[0]}</span>}</span>
              <b>{c.name}</b>
              <small>{c.symbols.length} {c.builtIn ? '' : '· yours'}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="lib-head">
            <button className="btn small" onClick={() => setOpenId(null)}><IconBack size={18} /> {t('All categories')}</button>
            {open.icon && <Symbol value={open.icon} className="lib-head-icon" />}
            <b className="grow">{open.name}</b>
            {mode === 'manage' && !open.builtIn && (
              <button className="btn small" onClick={() => setEditCat(open)}><IconEdit size={18} /> {t('Edit')}</button>
            )}
            {mode === 'manage' && (
              <button className="btn small primary" onClick={() => setEditSym({ cat: open, sym: null })}><IconPlus size={18} /> {t('Add symbol')}</button>
            )}
          </div>
          <div className="sym-grid">
            {open.symbols.map((s) => (
              <button key={s.id} className={`sym-opt ${open.customIds.has(s.id) ? 'custom' : ''}`} onClick={() => tapSymbol(open, s)} title={s.label}>
                <Symbol value={s.symbol} lazy />
                <span>{s.label}</span>
                {mode === 'manage' && open.customIds.has(s.id) && <IconEdit size={14} className="sym-opt-edit" />}
              </button>
            ))}
            {mode === 'manage' && (
              <button className="sym-opt add" onClick={() => setEditSym({ cat: open, sym: null })}>
                <IconPlus size={32} />
                <span>{t('Add symbol')}</span>
              </button>
            )}
          </div>
          {open.symbols.length === 0 && mode === 'pick' && <p className="muted">{t('This category is empty. Add symbols in Grown-ups → Symbols.')}</p>}
        </>
      )}

      {editCat && (
        <CategoryEditor
          cat={editCat === 'new' ? null : editCat}
          onClose={() => setEditCat(null)}
          onSaved={(id) => { setEditCat(null); setOpenId(id); }}
          onDeleted={() => { setEditCat(null); setOpenId(null); }}
        />
      )}
      {editSym && <SymbolEditor cat={editSym.cat} sym={editSym.sym} categories={cats} onClose={() => setEditSym(null)} />}
    </div>
  );
}

export function CategoryEditor({ cat, onClose, onSaved, onDeleted }: {
  cat: ViewCategory | null; onClose: () => void; onSaved: (id: string) => void; onDeleted: () => void;
}) {
  const { updateLibrary, showToast } = useStore.getState();
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState<string | undefined>(cat?.icon);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    const id = cat?.id ?? uid('cat-');
    updateLibrary((lib) => {
      const existing = lib.categories.find((c) => c.id === id);
      if (existing) { existing.name = name.trim(); existing.icon = icon; }
      else lib.categories.unshift({ id, name: name.trim(), icon, symbols: [] });
    });
    showToast(cat ? 'Category saved' : 'Category created. Now add symbols to it.');
    onSaved(id);
  };

  return (
    <>
      <Modal title={cat ? 'Edit category' : 'New category'} onClose={onClose}
        footer={<>
          {cat && <button className="btn danger-outline" onClick={() => setConfirm(true)}><IconTrash /> {t('Delete')}</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={save}>{t('Save')}</button>
        </>}>
        <div className="cat-editor">
          <button className="lib-folder preview" onClick={() => setPicking(true)} aria-label={t('Choose category icon')}>
            <span className="lib-folder-icon">{icon ? <Symbol value={icon} /> : <span className="lib-folder-blank">{name[0] ?? '?'}</span>}</span>
            <b>{name || 'Category'}</b>
            <small>{t('Tap to choose icon')}</small>
          </button>
          <label className="field grow"><span>{t('Name')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Grandma's house, Soccer, My toys")} />
          </label>
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={name} noLibrarySave onClose={() => setPicking(false)} onPick={(s) => { setIcon(s); setPicking(false); }} />}
      {confirm && cat && (
        <Modal title={`Delete “${cat.name}”?`} onClose={() => setConfirm(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setConfirm(false)}>{t('Cancel')}</button>
            <button className="btn danger" onClick={() => { updateLibrary((lib) => { lib.categories = lib.categories.filter((c) => c.id !== cat.id); }, { undo: `Deleted “${cat.name}”` }); onDeleted(); }}>{t('Delete')}</button></>}>
          <p>This removes the category and its {cat.symbols.length} symbol(s) from the library. Buttons already on boards keep their pictures.</p>
        </Modal>
      )}
    </>
  );
}

export function SymbolEditor({ cat, sym, categories, onClose, initial }: {
  cat: ViewCategory; sym: LibrarySymbol | null; categories: ViewCategory[]; onClose: () => void; initial?: Partial<LibrarySymbol>;
}) {
  const { updateLibrary, showToast } = useStore.getState();
  const [label, setLabel] = useState(sym?.label ?? initial?.label ?? '');
  const [symbol, setSymbol] = useState<string | undefined>(sym?.symbol ?? initial?.symbol);
  const [type, setType] = useState<WordType>(sym?.type ?? initial?.type ?? 'noun');
  const [catId, setCatId] = useState(cat.id);
  const [picking, setPicking] = useState(!sym && !initial?.symbol);

  const removeFrom = (lib: import('../types').SymbolLibrary, id: string) => {
    lib.categories.forEach((c) => { c.symbols = c.symbols.filter((s) => s.id !== id); });
    for (const k of Object.keys(lib.additions)) lib.additions[k] = lib.additions[k].filter((s) => s.id !== id);
  };

  const save = () => {
    if (!symbol || !label.trim()) return;
    const entry: LibrarySymbol = { id: sym?.id ?? uid('sym-'), label: label.trim(), symbol, type };
    const target = categories.find((c) => c.id === catId)!;
    updateLibrary((lib) => {
      removeFrom(lib, entry.id);
      if (target.builtIn) (lib.additions[target.id] ??= []).unshift(entry);
      else lib.categories.find((c) => c.id === target.id)?.symbols.unshift(entry);
    });
    showToast(sym ? 'Symbol saved' : `Added to “${target.name}”`);
    onClose();
  };

  return (
    <>
      <Modal title={sym ? 'Edit symbol' : 'New symbol'} onClose={onClose}
        footer={<>
          {sym && <button className="btn danger-outline" onClick={() => { updateLibrary((lib) => removeFrom(lib, sym.id), { undo: `Deleted “${sym.label}”` }); onClose(); }}><IconTrash /> {t('Delete')}</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!symbol || !label.trim()} onClick={save}>{t('Save')}</button>
        </>}>
        <div className="cat-editor">
          <button className="sym-opt preview" onClick={() => setPicking(true)} aria-label={t('Choose picture')}>
            {symbol ? <Symbol value={symbol} /> : <IconPlus size={40} />}
            <span>{symbol ? 'Change picture' : 'Add picture'}</span>
          </button>
          <div className="grow">
            <label className="field"><span>{t('Word')}</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('e.g. Grandma, trampoline')} />
            </label>
            <label className="field"><span>{t('Category')}</span>
              <select value={catId} onChange={(e) => setCatId(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.builtIn ? '' : ' (yours)'}</option>)}
              </select>
            </label>
            <label className="field"><span>Word type (colour on buttons)</span>
              <select value={type} onChange={(e) => setType(e.target.value as WordType)}>
                {(Object.keys(WORD_COLORS) as WordType[]).filter((w) => w !== 'folder').map((w) => <option key={w} value={w}>{t(WORD_COLORS[w].name)}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={label} noLibrarySave onClose={() => setPicking(false)} onPick={(s) => { setSymbol(s); setPicking(false); }} />}
    </>
  );
}
