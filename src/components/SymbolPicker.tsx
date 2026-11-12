import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { searchBundled } from '../data/defaults';
import { putAsset } from '../lib/db';
import { resizeImage, uid } from '../lib/util';
import { IconCamera, IconSearch } from './Icons';

const EMOJI = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😍 🥰 😘 😋 😛 🤪 🤔 🤗 🤭 😐 😑 😶 🙄 😏 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 😎 😕 😟 🙁 😮 😲 😳 🥺 😦 😧 😨 😰 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 👍 👎 👋 👏 🙌 🙏 ✋ 👉 👈 ☝️ 👆 👇 ✌️ 🤞 👌 💪 🫶 ❤️ 💔 ⭐ 🌟 ✨ 🔥 💧 🌈 ☀️ 🌙 ⛅ 🌧️ ❄️ 🍎 🍌 🍇 🍓 🍉 🍕 🍔 🍟 🌭 🍪 🍰 🍦 🍫 🥤 🧃 🥛 💧 ⚽ 🏀 🎈 🎨 🎵 🎮 📺 📱 💻 📚 🚗 🚌 🚲 ✈️ 🏠 🏫 🏥 🛝 🐶 🐱 🐟 🐦 🦖 🦄 🧸 🛁 🚽 🛏️ 👕 👖 👟 🧢 🎒 🎁 🎉 🎂 ⏰ ⏳ ✅ ❌ ❓ ❗ ➕ ➖ 🔊 🔇'.split(' ');

interface Props {
  initialQuery?: string;
  onPick: (ref: string | undefined) => void;
  onClose: () => void;
}

type Tab = 'symbols' | 'online' | 'emoji' | 'photo';

interface ArasaacResult { _id: number; keywords: { keyword: string }[] }

export function SymbolPicker({ initialQuery = '', onPick, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('symbols');
  const [q, setQ] = useState(initialQuery);
  const [online, setOnline] = useState<ArasaacResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const bundled = searchBundled(q);

  useEffect(() => {
    if (tab !== 'online' || !q.trim()) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (r.status === 404) setOnline([]);
        else if (!r.ok) throw new Error(String(r.status));
        else setOnline(((await r.json()) as ArasaacResult[]).slice(0, 60));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Could not reach the symbol library. Are you online?');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, tab]);

  const pickOnline = async (id: number) => {
    setLoading(true);
    try {
      const r = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_300.png`);
      const blob = await resizeImage(await r.blob(), 256);
      const assetId = uid('arasaac-');
      await putAsset(assetId, blob);
      onPick(`img:${assetId}`);
    } catch {
      setError('Download failed. Try again when online.');
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
      setError('Could not read that image.');
      setLoading(false);
    }
  };

  return (
    <Modal title="Choose a picture" onClose={onClose} wide>
      <div className="tabs">
        {(['symbols', 'online', 'emoji', 'photo'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ symbols: 'Symbols', online: 'More symbols (online)', emoji: 'Emoji', photo: 'Photo' }[t]}
          </button>
        ))}
      </div>
      {(tab === 'symbols' || tab === 'online') && (
        <label className="search">
          <IconSearch size={20} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pictures…" />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {tab === 'symbols' && (
        <>
          <div className="sym-grid">
            {bundled.map((r) => (
              <button key={r.symbol} className="sym-opt" onClick={() => onPick(r.symbol)} title={r.keyword}>
                <Symbol value={r.symbol} lazy />
                <span>{r.keyword}</span>
              </button>
            ))}
          </div>
          {q && !bundled.length && <p className="muted">Nothing in the built-in set. Try “More symbols (online)”.</p>}
        </>
      )}
      {tab === 'online' && (
        <div className="sym-grid">
          {online.map((r) => (
            <button key={r._id} className="sym-opt" onClick={() => pickOnline(r._id)} title={r.keywords[0]?.keyword}>
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
          <p>Real photos of the person's own things, people and places are often the easiest to understand.</p>
          <div className="row">
            <button className="btn primary" onClick={() => camRef.current?.click()}><IconCamera /> Take photo</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Choose from gallery</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      )}
      <div className="row-end">
        <button className="btn" onClick={() => onPick(undefined)}>No picture</button>
      </div>
      <p className="credit">Symbols: ARASAAC (Sergio Palao, Gov. of Aragón), CC BY-NC-SA.</p>
    </Modal>
  );
}
