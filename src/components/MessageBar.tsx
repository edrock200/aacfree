import { useEffect, useRef, useState } from 'react';
import { useStore, useSettings } from '../store';
import { applyCase, joinWords } from '../lib/sentence';
import { Symbol } from './Symbol';
import { IconBack, IconBackspace, IconClose, IconExpand, IconHome, IconSpeak, IconStar } from './Icons';
import { usePress } from '../lib/usePress';
import { uid } from '../lib/util';

export function MessageBar({ onShow }: { onShow: (text: string) => void }) {
  const message = useStore((st) => st.message);
  const draft = useStore((st) => st.draft);
  const boardStack = useStore((st) => st.boardStack);
  const screen = useStore((st) => st.screen);
  const s = useSettings();
  const { speakMessage, backspace, clearMessage, home, back, setFormsFor, updateProfile, showToast, setScreen } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: s.reduceMotion ? 'auto' : 'smooth' });
    setSaved(false);
  }, [message.length, draft, s.reduceMotion]);

  const text = joinWords(draft ? [...message, { text: draft }] : message);
  const pressOpts = { holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown };
  const speakPress = usePress({ ...pressOpts, onActivate: speakMessage });
  const barPress = usePress({ ...pressOpts, onActivate: speakMessage });
  const bsPress = usePress({ ...pressOpts, onActivate: backspace, onLongPress: clearMessage });
  const homePress = usePress({ ...pressOpts, onActivate: home });
  const backPress = usePress({ ...pressOpts, onActivate: () => (screen !== 'talk' ? setScreen('talk') : back()) });

  const savePhrase = () => {
    if (!text) return;
    updateProfile((p) => {
      if (!p.phrases.some((x) => x.text === text)) {
        p.phrases.unshift({ id: uid('ph'), text, category: 'Favorites', symbol: message.find((w) => w.symbol)?.symbol });
        if (!p.phraseCategories.includes('Favorites')) p.phraseCategories.unshift('Favorites');
      }
    });
    setSaved(true);
    showToast('Saved to Phrases ★');
  };

  const canBack = boardStack.length > 1 || screen !== 'talk';

  return (
    <div className="msgbar" data-scan-group>
      <button className="iconbtn nav-home" aria-label="Home" data-scan-item {...homePress}><IconHome /></button>
      <button className="iconbtn nav-back" aria-label="Back" data-scan-item disabled={!canBack} {...backPress}><IconBack /></button>
      <div className="msg" role="button" tabIndex={0} aria-label={text ? `Message: ${text}. Tap to speak.` : 'Message bar, empty'} {...barPress}>
        <div className="msg-words" ref={scroller}>
          {message.length === 0 && !draft && <span className="msg-placeholder">Tap words to talk</span>}
          {message.map((w, i) => (
            <button
              key={w.id}
              className="msg-word"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setFormsFor({ index: i }); }}
              aria-label={`${w.text}, change word`}
            >
              {s.showSymbolsInBar && w.symbol && <Symbol value={w.symbol} />}
              <span>{applyCase(w.text, s.textCase)}</span>
            </button>
          ))}
          {draft && <span className="msg-word draft"><span>{draft}</span><i className="caret" /></span>}
        </div>
        {(message.length > 0 || draft) && (
          <div className="msg-tools" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button className="iconbtn small" aria-label="Save as phrase" onClick={(e) => { e.stopPropagation(); savePhrase(); }} data-scan-item>
              <IconStar size={20} filled={saved} />
            </button>
            <button className="iconbtn small" aria-label="Show in big text" onClick={(e) => { e.stopPropagation(); onShow(text); }} data-scan-item>
              <IconExpand size={20} />
            </button>
            <button className="iconbtn small" aria-label="Clear message" onClick={(e) => { e.stopPropagation(); clearMessage(); }} data-scan-item>
              <IconClose size={20} />
            </button>
          </div>
        )}
      </div>
      <button className="iconbtn nav-bs" aria-label="Delete last word (hold to clear)" data-scan-item {...bsPress}><IconBackspace /></button>
      <button className="speakbtn" aria-label="Speak" data-scan-item {...speakPress}><IconSpeak size={30} /><span>Speak</span></button>
    </div>
  );
}
