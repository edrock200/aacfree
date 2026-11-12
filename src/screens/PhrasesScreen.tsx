import { useState } from 'react';
import { useStore, useProfile, recentId } from '../store';
import { Symbol } from '../components/Symbol';
import { usePress } from '../lib/usePress';
import { IconPlus, IconStar, IconTrash, IconEdit, IconCheck, IconEyeOff } from '../components/Icons';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SymbolPicker } from '../components/SymbolPicker';
import { AudioRecorder } from '../components/AudioRecorder';
import { PersonButton } from './talkControls';
import { addSnapshot } from '../lib/db';
import { uid } from '../lib/util';
import type { Phrase, Settings } from '../types';
import { t } from '../i18n';

function PhraseButton({ phrase, s, onPress, onEdit, edit }: { phrase: Phrase; s: Settings; onPress: () => void; onEdit?: () => void; edit: boolean }) {
  const press = usePress({ onActivate: edit && onEdit ? onEdit : onPress, holdMs: edit ? 0 : s.holdMs, debounceMs: s.debounceMs, pressOnDown: !edit && s.pressOnDown });
  return (
    <button className="phrase" data-scan-item aria-label={edit ? t('Edit phrase: {v0}', { v0: phrase.text }) : phrase.text} {...press}>
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
  const contentEdit = useStore((st) => st.contentEdit);
  const isPrivate = useStore((st) => st.isPrivate);
  const { speakText, updateProfile, addText, setContentEdit, clearRecent, deleteRecent, setPrivate, showToast } = useStore.getState();
  const cats = ['Recent', ...p.phraseCategories];
  const [cat, setCat] = useState(() => (p.phraseCategories.includes('Favorites') ? 'Favorites' : p.phraseCategories[0] ?? 'Recent'));
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [newCat, setNewCat] = useState(false);
  // A plain tap always speaks. Editing needs Grown-ups unlocked AND the pencil switched on.
  const edit = unlocked && contentEdit;

  const list = p.phrases.filter((x) => x.category === cat);

  const save = (ph: Phrase) => {
    updateProfile((pp) => {
      const i = pp.phrases.findIndex((x) => x.id === ph.id);
      if (i >= 0) pp.phrases[i] = ph;
      else pp.phrases.push(ph);
    });
    setEditing(null);
  };

  const removePhrase = (ph: Phrase) => {
    const index = p.phrases.findIndex((x) => x.id === ph.id);
    addSnapshot(useStore.getState().data, 'Before deleting a phrase').catch(() => {});
    updateProfile((pp) => { pp.phrases = pp.phrases.filter((x) => x.id !== ph.id); });
    setEditing(null);
    showToast(t('Phrase deleted'), {
      label: 'Undo',
      run: () => updateProfile((pp) => {
        if (pp.phrases.some((x) => x.id === ph.id)) return;
        pp.phrases.splice(Math.min(Math.max(0, index), pp.phrases.length), 0, ph);
        if (!pp.phraseCategories.includes(ph.category)) pp.phraseCategories.push(ph.category);
      }),
    });
  };

  return (
    <div className="phrases-screen">
      <div className="tabs scroll" data-scan-group>
        {cats.map((c) => (
          <PersonButton key={c} s={s} className={`tab ${cat === c ? 'active' : ''}`} onPress={() => setCat(c)}>{c}</PersonButton>
        ))}
        {edit && <button className="tab add" onClick={() => setNewCat(true)}><IconPlus size={18} /> {t('Group')}</button>}
        {unlocked && (
          <button className={`tab ${edit ? 'active' : ''}`} aria-pressed={edit} onClick={() => setContentEdit(!edit)}>
            {edit ? <><IconCheck size={18} /> {t('Done editing')}</> : <><IconEdit size={18} /> {t('Edit phrases')}</>}
          </button>
        )}
      </div>
      {cat === 'Recent' ? (
        <>
          <div className="recent-tools row" data-scan-group>
            <PersonButton s={s} className={`btn small ${isPrivate ? 'primary' : ''}`} pressed={isPrivate} onPress={() => setPrivate(!isPrivate)}>
              <IconEyeOff size={18} /> {t('Private for now')}
            </PersonButton>
            {p.history.length > 0 && (
              <PersonButton s={s} className="btn small" onPress={clearRecent}><IconTrash size={18} /> {t('Clear recent')}</PersonButton>
            )}
          </div>
          {isPrivate && <p className="muted small">{t("Private for now: new sentences aren't kept here and nothing is logged.")}</p>}
          {s.keepRecent === 'off' && !isPrivate && <p className="muted small">{t('Recent sentences are switched off in Grown-ups.')}</p>}
          <div className="phrase-list" data-scan-group>
          {p.history.length === 0 && s.keepRecent !== 'off' && <p className="muted center">{t('Sentences you speak will show up here.')}</p>}
          {p.history.slice(0, 50).map((h) => (
            <div className="recent-row" key={recentId(h)}>
              <PhraseButton phrase={{ id: recentId(h), text: h.text, category: '' }} s={s} edit={false} onPress={() => speakText(h.text, { log: 'phrase', stoppable: true })} />
              <PersonButton s={s} className="iconbtn" label={t('Put in message bar')} onPress={() => addText(h.text)}><IconPlus /></PersonButton>
              <PersonButton s={s} className="iconbtn" label={t('Save to favourites')}
                onPress={() => updateProfile((pp) => {
                  if (pp.phrases.some((x) => x.text === h.text)) return;
                  if (!pp.phraseCategories.includes('Favorites')) pp.phraseCategories.unshift('Favorites');
                  pp.phrases.unshift({ id: uid('ph'), text: h.text, category: 'Favorites' });
                })}>
                <IconStar filled={p.phrases.some((x) => x.text === h.text)} />
              </PersonButton>
              <PersonButton s={s} className="iconbtn" label={t('Delete this sentence')} onPress={() => deleteRecent(recentId(h))}><IconTrash /></PersonButton>
            </div>
          ))}
          </div>
        </>
      ) : (
        <div className="phrase-grid" data-scan-group>
          {list.map((ph) => (
            <PhraseButton key={ph.id} phrase={ph} s={s} edit={edit} onEdit={() => setEditing(ph)}
              onPress={() => speakText(ph.text, { audio: ph.audio, log: 'phrase', stoppable: true })} />
          ))}
          {edit && (
            <button className="phrase add" onClick={() => setEditing({ id: uid('ph'), text: '', category: cat })}>
              <IconPlus /> <span>{t('Add phrase')}</span>
            </button>
          )}
          {list.length === 0 && !edit && <p className="muted center">{t('No phrases here yet. Tap ★ in the message bar to save one.')}</p>}
        </div>
      )}
      {editing && <PhraseEditor phrase={editing} categories={p.phraseCategories} onSave={save} onClose={() => setEditing(null)}
        onDelete={() => removePhrase(editing)} />}
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
  const [confirm, setConfirm] = useState(false);
  const dirty = ph.text !== phrase.text || ph.symbol !== phrase.symbol || ph.category !== phrase.category || ph.audio !== phrase.audio;
  return (
    <>
      <Modal title={phrase.text ? t('Edit phrase') : t('New phrase')} onClose={onClose} dirty={dirty}
        footer={
          <>
            {phrase.text && <button className="btn danger-outline" onClick={() => setConfirm(true)}><IconTrash /> {t('Delete')}</button>}
            <span className="spacer" />
            <button className="btn" onClick={onClose}>{t('Cancel')}</button>
            <button className="btn primary" disabled={!ph.text.trim()} onClick={() => onSave({ ...ph, text: ph.text.trim() })}>{t('Save')}</button>
          </>
        }>
        <label className="field"><span>{t('Phrase or script')}</span>
          <textarea rows={3} autoFocus value={ph.text} onChange={(e) => setPh({ ...ph, text: e.target.value })} placeholder={t('e.g. To infinity and beyond!')} />
        </label>
        <p className="muted small">{t('Tip for gestalt language processors: save whole scripts exactly as the person says them, like movie lines and song lyrics. They carry real meaning.')}</p>
        <label className="field"><span>{t('Group')}</span>
          <select value={ph.category} onChange={(e) => setPh({ ...ph, category: e.target.value })}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="field"><span>{t('Picture')}</span>
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
      {confirm && (
        <ConfirmDialog title={t('Delete this phrase?')} onClose={() => setConfirm(false)} onConfirm={onDelete}>
          <p>“{phrase.text}”</p>
          {phrase.audio && <p>{t('Its recorded voice clip is deleted too.')}</p>}
          <p className="muted small">{t('You can press Undo straight after.')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function NewCategory({ onSave, onClose }: { onSave: (n: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title={t('New phrase group')} onClose={onClose} dirty={!!name.trim()}
      footer={<><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>{t('Add')}</button></>}>
      <label className="field"><span>{t('Name')}</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Scripts, Grandma, Soccer')} /></label>
    </Modal>
  );
}
