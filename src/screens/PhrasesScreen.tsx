import { useState } from 'react';
import { useStore, useProfile } from '../store';
import { Symbol } from '../components/Symbol';
import { usePress } from '../lib/usePress';
import { IconPlus, IconStar, IconTrash, IconEdit } from '../components/Icons';
import { Modal } from '../components/Modal';
import { SymbolPicker } from '../components/SymbolPicker';
import { AudioRecorder } from '../components/AudioRecorder';
import { uid } from '../lib/util';
import type { Phrase, Settings } from '../types';

function PhraseButton({ phrase, s, onPress, onEdit, edit }: { phrase: Phrase; s: Settings; onPress: () => void; onEdit?: () => void; edit: boolean }) {
  const press = usePress({ onActivate: edit && onEdit ? onEdit : onPress, holdMs: edit ? 0 : s.holdMs, debounceMs: s.debounceMs, pressOnDown: !edit && s.pressOnDown });
  return (
    <button className="phrase" data-scan-item aria-label={phrase.text} {...press}>
      {phrase.symbol && <Symbol value={phrase.symbol} />}
      <span>{phrase.text}</span>
      {edit && <IconEdit size={18} className="phrase-edit" />}
    </button>
  );
}

export function PhrasesScreen() {
  const p = useProfile();
  const s = p.settings;
  const unlocked = useStore((st) => st.unlocked);
  const { speakText, updateProfile, addText } = useStore.getState();
  const cats = ['Recent', ...p.phraseCategories];
  const [cat, setCat] = useState(() => (p.phraseCategories.includes('Favorites') ? 'Favorites' : p.phraseCategories[0] ?? 'Recent'));
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [newCat, setNewCat] = useState(false);
  const edit = unlocked;

  const list = p.phrases.filter((x) => x.category === cat);

  const save = (ph: Phrase) => {
    updateProfile((pp) => {
      const i = pp.phrases.findIndex((x) => x.id === ph.id);
      if (i >= 0) pp.phrases[i] = ph;
      else pp.phrases.push(ph);
    });
    setEditing(null);
  };

  return (
    <div className="phrases-screen">
      <div className="tabs scroll" data-scan-group>
        {cats.map((c) => (
          <button key={c} className={`tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)} data-scan-item>{c}</button>
        ))}
        {edit && <button className="tab add" onClick={() => setNewCat(true)}><IconPlus size={18} /> Group</button>}
      </div>
      {cat === 'Recent' ? (
        <div className="phrase-list" data-scan-group>
          {p.history.length === 0 && <p className="muted center">Sentences you speak will show up here.</p>}
          {p.history.slice(0, 50).map((h, i) => (
            <div className="recent-row" key={h.t + '-' + i}>
              <PhraseButton phrase={{ id: String(i), text: h.text, category: '' }} s={s} edit={false} onPress={() => speakText(h.text, { log: 'phrase' })} />
              <button className="iconbtn" aria-label="Put in message bar" onClick={() => addText(h.text)} data-scan-item><IconPlus /></button>
              <button
                className="iconbtn"
                aria-label="Save to favourites"
                data-scan-item
                onClick={() => updateProfile((pp) => {
                  if (pp.phrases.some((x) => x.text === h.text)) return;
                  if (!pp.phraseCategories.includes('Favorites')) pp.phraseCategories.unshift('Favorites');
                  pp.phrases.unshift({ id: uid('ph'), text: h.text, category: 'Favorites' });
                })}
              >
                <IconStar filled={p.phrases.some((x) => x.text === h.text)} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="phrase-grid" data-scan-group>
          {list.map((ph) => (
            <PhraseButton key={ph.id} phrase={ph} s={s} edit={edit} onEdit={() => setEditing(ph)}
              onPress={() => speakText(ph.text, { audio: ph.audio, log: 'phrase' })} />
          ))}
          {edit && (
            <button className="phrase add" onClick={() => setEditing({ id: uid('ph'), text: '', category: cat })}>
              <IconPlus /> <span>Add phrase</span>
            </button>
          )}
          {list.length === 0 && !edit && <p className="muted center">No phrases here yet. Tap ★ in the message bar to save one.</p>}
        </div>
      )}
      {editing && <PhraseEditor phrase={editing} categories={p.phraseCategories} onSave={save} onClose={() => setEditing(null)}
        onDelete={() => { updateProfile((pp) => { pp.phrases = pp.phrases.filter((x) => x.id !== editing.id); }); setEditing(null); }} />}
      {newCat && <NewCategory onClose={() => setNewCat(false)} onSave={(name) => {
        updateProfile((pp) => { if (!pp.phraseCategories.includes(name)) pp.phraseCategories.push(name); });
        setCat(name);
        setNewCat(false);
      }} />}
      {edit && cat !== 'Recent' && list.length === 0 && p.phraseCategories.includes(cat) && (
        <div className="row-center">
          <button className="btn danger-outline" onClick={() => {
            updateProfile((pp) => { pp.phraseCategories = pp.phraseCategories.filter((c) => c !== cat); });
            setCat('Recent');
          }}><IconTrash /> Remove empty group “{cat}”</button>
        </div>
      )}
    </div>
  );
}

function PhraseEditor({ phrase, categories, onSave, onClose, onDelete }: { phrase: Phrase; categories: string[]; onSave: (p: Phrase) => void; onClose: () => void; onDelete: () => void }) {
  const [ph, setPh] = useState(phrase);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Modal title={phrase.text ? 'Edit phrase' : 'New phrase'} onClose={onClose}
        footer={
          <>
            {phrase.text && <button className="btn danger-outline" onClick={onDelete}><IconTrash /> Delete</button>}
            <span className="spacer" />
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!ph.text.trim()} onClick={() => onSave({ ...ph, text: ph.text.trim() })}>Save</button>
          </>
        }>
        <label className="field"><span>Phrase or script</span>
          <textarea rows={3} autoFocus value={ph.text} onChange={(e) => setPh({ ...ph, text: e.target.value })} placeholder="e.g. To infinity and beyond!" />
        </label>
        <p className="muted small">Tip for gestalt language processors: save whole scripts exactly as the person says them, like movie lines and song lyrics. They carry real meaning.</p>
        <label className="field"><span>Group</span>
          <select value={ph.category} onChange={(e) => setPh({ ...ph, category: e.target.value })}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="field"><span>Picture</span>
          <div className="row">
            {ph.symbol && <Symbol value={ph.symbol} className="preview-sym" />}
            <button className="btn" onClick={() => setPicking(true)}>{ph.symbol ? 'Change' : 'Add picture'}</button>
          </div>
        </div>
        <div className="field"><span>Recorded voice (optional)</span>
          <AudioRecorder value={ph.audio} onChange={(audio) => setPh({ ...ph, audio })} />
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={ph.text.split(' ').slice(-1)[0]?.replace(/[^a-z]/gi, '')} onClose={() => setPicking(false)} onPick={(symbol) => { setPh({ ...ph, symbol }); setPicking(false); }} />}
    </>
  );
}

function NewCategory({ onSave, onClose }: { onSave: (n: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title="New phrase group" onClose={onClose}
      footer={<><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Add</button></>}>
      <label className="field"><span>Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Scripts, Grandma, Soccer" /></label>
    </Modal>
  );
}
