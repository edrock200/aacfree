import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useProfile } from '../store';
import { predict } from '../lib/predict';
import { vocabularyWords } from '../lib/boards';
import { usePress } from '../lib/usePress';
import { IconBackspace } from '../components/Icons';
import type { Settings } from '../types';

const QWERTY = ['qwertyuiop', 'asdfghjkl\'', 'zxcvbnm'];
const ABC = ['abcdefghi', 'jklmnopqr', 'stuvwxyz\''];
const NUMS = ['1234567890', '-/:;()$&@"', '.,?!\'#%+='];

function Key({ label, onPress, s, className = '', aria }: { label: React.ReactNode; onPress: () => void; s: Settings; className?: string; aria?: string }) {
  const press = usePress({ onActivate: onPress, holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown });
  return <button className={`key ${className}`} data-scan-item aria-label={aria ?? (typeof label === 'string' ? label : undefined)} {...press}>{label}</button>;
}

export function KeyboardScreen() {
  const p = useProfile();
  const s = p.settings;
  const draft = useStore((st) => st.draft);
  const message = useStore((st) => st.message);
  const { setDraft, commitDraft, addText, backspace, speakText } = useStore.getState();
  const [mode, setMode] = useState<'letters' | 'numbers'>('letters');
  const [shift, setShift] = useState(false);

  const vocab = useMemo(() => vocabularyWords(p), [p.boards]);
  const prev = message[message.length - 1]?.text;
  const suggestions = predict(draft, prev, { vocabulary: vocab, lexicon: s.learnWords ? p.lexicon : {}, history: s.learnWords ? p.history : [] });

  const rows = mode === 'numbers' ? NUMS : s.keyboardLayout === 'abc' ? ABC : QWERTY;

  const type = (ch: string) => {
    const c = shift ? ch.toUpperCase() : ch;
    if (/[.,?!]/.test(ch) && mode === 'numbers' && !draft) {
      // Punctuation attaches to previous word.
      addText(ch);
      return;
    }
    setDraft(draft + c);
    setShift(false);
  };

  const pick = (w: string) => {
    setDraft('');
    addText(w);
    if (s.speakOnTap) speakText(w);
  };

  const space = () => {
    if (draft) {
      const w = draft;
      commitDraft();
      if (s.speakOnTap) speakText(w);
    }
  };

  const del = () => {
    if (draft) setDraft(draft.slice(0, -1));
    else {
      // Pull the last word back for editing.
      const last = message[message.length - 1];
      if (!last) return;
      backspace();
      setDraft(last.text.slice(0, -1));
    }
  };

  // Physical / Bluetooth keyboards type straight into the message (not into focused buttons).
  const handlers = useRef({ type, del, space });
  handlers.current = { type, del, space };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (s.scanning || e.ctrlKey || e.metaKey || e.altKey || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || document.querySelector('.modal-root')) return;
      if (e.key === 'Enter') { e.preventDefault(); useStore.getState().speakMessage(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); handlers.current.del(); return; }
      if (e.key === ' ') { e.preventDefault(); handlers.current.space(); return; }
      if (e.key.length === 1 && /[\p{L}\p{N}'.,?!-]/u.test(e.key)) {
        e.preventDefault();
        if (/[.,?!]/.test(e.key)) { commitDraft(); addText(e.key); } else handlers.current.type(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.scanning, commitDraft, addText]);

  return (
    <div className="keyboard">
      <div className="predictions" data-scan-group>
        {suggestions.map((w) => (
          <Key key={w} label={w} s={s} onPress={() => pick(w)} className="pred" />
        ))}
      </div>
      <div className="keys" style={{ gap: `${Math.max(4, s.gap)}px` }}>
        {rows.map((r, i) => (
          <div className="key-row" key={i} data-scan-group style={{ gap: `${Math.max(4, s.gap)}px` }}>
            {i === 2 && mode === 'letters' && <Key label="⇧" aria="Shift" s={s} onPress={() => setShift(!shift)} className={`wide ${shift ? 'on' : ''}`} />}
            {[...r].map((ch) => (
              <Key key={ch} label={shift ? ch.toUpperCase() : ch} s={s} onPress={() => type(ch)} />
            ))}
            {i === 2 && <Key label={<IconBackspace />} aria="Delete letter" s={s} onPress={del} className="wide" />}
          </div>
        ))}
        <div className="key-row" data-scan-group style={{ gap: `${Math.max(4, s.gap)}px` }}>
          <Key label={mode === 'letters' ? '123' : 'abc'} aria="Switch numbers and letters" s={s} onPress={() => setMode(mode === 'letters' ? 'numbers' : 'letters')} className="wide" />
          <Key label="." s={s} onPress={() => { commitDraft(); addText('.'); }} />
          <Key label="?" s={s} onPress={() => { commitDraft(); addText('?'); }} />
          <Key label="space" s={s} onPress={space} className="space" />
          <Key label="!" s={s} onPress={() => { commitDraft(); addText('!'); }} />
          <Key label="," s={s} onPress={() => { commitDraft(); addText(','); }} />
        </div>
      </div>
    </div>
  );
}
