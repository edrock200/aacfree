import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { putAsset } from '../lib/db';
import { LibraryBrowser } from './LibraryBrowser';
import { useStore } from '../store';
import { allCategories } from '../lib/library';
import symbolMap from '../data/symbols.json';

const BUNDLED = new Set(Object.values(symbolMap as Record<string, number | null>).filter((x): x is number => !!x));
import { resizeImage, uid } from '../lib/util';
import { IconCamera, IconSearch } from './Icons';
import { getLang, t } from '../i18n';

const EMOJI = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😍 🥰 😘 😋 😛 🤪 🤔 🤗 🤭 😐 😑 😶 🙄 😏 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 😎 😕 😟 🙁 😮 😲 😳 🥺 😦 😧 😨 😰 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 👍 👎 👋 👏 🙌 🙏 ✋ 👉 👈 ☝️ 👆 👇 ✌️ 🤞 👌 💪 🫶 ❤️ 💔 ⭐ 🌟 ✨ 🔥 💧 🌈 ☀️ 🌙 ⛅ 🌧️ ❄️ 🍎 🍌 🍇 🍓 🍉 🍕 🍔 🍟 🌭 🍪 🍰 🍦 🍫 🥤 🧃 🥛 💧 ⚽ 🏀 🎈 🎨 🎵 🎮 📺 📱 💻 📚 🚗 🚌 🚲 ✈️ 🏠 🏫 🏥 🛝 🐶 🐱 🐟 🐦 🦖 🦄 🧸 🛁 🚽 🛏️ 👕 👖 👟 🧢 🎒 🎁 🎉 🎂 ⏰ ⏳ ✅ ❌ ❓ ❗ ➕ ➖ 🔊 🔇'.split(' ');

interface Props {
  initialQuery?: string;
  /** `label` is the library word when a library symbol was chosen. */
  onPick: (ref: string | undefined, label?: string) => void;
  onClose: () => void;
  /** Hide the "save to my library" option (used inside the library editors). */
  noLibrarySave?: boolean;
}

type Tab = 'library' | 'online' | 'emoji' | 'photo';

interface ArasaacResult { _id: number; keywords: { keyword: string }[] }

export function SymbolPicker({ initialQuery = '', onPick: onPickRaw, onClose, noLibrarySave }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const library = useStore((st) => st.data.library);
  const cats = allCategories(library);
  const [saveCat, setSaveCat] = useState('');
  const [saveLabel, setSaveLabel] = useState(initialQuery);

  /** Optionally keep downloaded pictures and photos in the family's library for reuse. */
  const onPick = (ref: string | undefined, label?: string) => {
    if (ref && saveCat && !noLibrarySave && (tab === 'online' || tab === 'photo')) {
      const target = cats.find((c) => c.id === saveCat);
      const entry = { id: uid('sym-'), label: (saveLabel || label || 'picture').trim(), symbol: ref };
      useStore.getState().updateLibrary((lib) => {
        if (target?.builtIn) (lib.additions[saveCat] ??= []).unshift(entry);
        else lib.categories.find((c) => c.id === saveCat)?.symbols.unshift(entry);
      });
      useStore.getState().showToast(t('Saved to “{v0}” in your symbols', { v0: target?.name }));
    }
    onPickRaw(ref, label);
  };
  const [q, setQ] = useState(initialQuery);
  const [online, setOnline] = useState<ArasaacResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (tab !== 'online' || !q.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`https://api.arasaac.org/v1/pictograms/${getLang()}/search/${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (r.status === 404) setOnline([]);
        else if (!r.ok) throw new Error(String(r.status));
        else setOnline(((await r.json()) as ArasaacResult[]).slice(0, 60));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(t('Could not reach the symbol library. Are you online?'));
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, tab]);

  const pickOnline = async (id: number, label?: string) => {
    // Already bundled (offline): no download needed.
    if (BUNDLED.has(id)) return onPick(`a:${id}`, label);
    setLoading(true);
    try {
      const r = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_300.png`);
      const blob = await resizeImage(await r.blob(), 256);
      const assetId = `arasaac-${id}`; // one stored copy per pictogram
      await putAsset(assetId, blob);
      onPick(`img:${assetId}`, label);
    } catch {
      setError(t('Download failed. Try again when online.'));
      setLoading(false);
    }
  };

  const pickFile = async (f?: File) => {
    if (!f) return;
    setLoading(true);
    try {
      const blob = await resizeImage(f, 480);
      const id = uid('photo-');
      await putAsset(id, blob);
      onPick(`img:${id}`);
    } catch {
      setError(t('Could not read that image.'));
      setLoading(false);
    }
  };

  return (
    <Modal title={t('Choose a picture')} onClose={onClose} wide>
      <div className="tabs">
        {(['library', 'online', 'emoji', 'photo'] as Tab[]).map((x) => (
          <button key={x} className={`tab ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)}>
            {t({ library: 'Symbols', online: 'More (online)', emoji: 'Emoji', photo: 'Photo' }[x])}
          </button>
        ))}
      </div>
      {!noLibrarySave && (tab === 'online' || tab === 'photo') && (
        <div className="save-to-lib">
          <span>{t('Also save to my symbols:')}</span>
          <select value={saveCat} onChange={(e) => setSaveCat(e.target.value)} aria-label={t('Save to category')}>
            <option value="">{t("Don't save")}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.builtIn ? '' : ' (yours)'}</option>)}
          </select>
          {saveCat && <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder={t('Word for this picture')} aria-label={t('Word for this picture')} />}
        </div>
      )}
      {tab === 'online' && (
        <label className="search">
          <IconSearch size={20} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search pictures…')} />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">{t('Loading…')}</p>}
      {tab === 'library' && <LibraryBrowser mode="pick" initialQuery={initialQuery} onPick={(sym) => onPick(sym.symbol, sym.label)} />}
      {tab === 'online' && (
        <div className="sym-grid">
          {online.map((r) => (
            <button key={r._id} className="sym-opt" onClick={() => pickOnline(r._id, r.keywords[0]?.keyword)} title={r.keywords[0]?.keyword}>
              <img className="sym" src={`https://static.arasaac.org/pictograms/${r._id}/${r._id}_300.png`} alt="" loading="lazy" />
              <span>{r.keywords[0]?.keyword}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'emoji' && (
        <div className="emoji-grid">
          {EMOJI.map((e, i) => (
            <button key={i} className="emoji-opt" onClick={() => onPick(`e:${e}`)}>{e}</button>
          ))}
        </div>
      )}
      {tab === 'photo' && (
        <div className="photo-pick">
          <p>{t("Real photos of the person's own things, people and places are often the easiest to understand.")}</p>
          <div className="row">
            <button className="btn primary" onClick={() => camRef.current?.click()}><IconCamera /> {t('Take photo')}</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>{t('Choose from gallery')}</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      )}
      <div className="row-end">
        <button className="btn" onClick={() => onPick(undefined)}>{t('No picture')}</button>
      </div>
      <p className="credit">Symbols: ARASAAC (Sergio Palao, Gov. of Aragón), CC BY-NC-SA.</p>
    </Modal>
  );
}
