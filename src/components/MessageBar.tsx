import { useEffect, useRef, useState } from 'react';
import { useStore, useSettings } from '../store';
import { applyCase, joinWords } from '../lib/sentence';
import { Symbol } from './Symbol';
import { IconBack, IconBackspace, IconClose, IconExpand, IconHome, IconMore, IconShare, IconSpeak, IconStar } from './Icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { usePress } from '../lib/usePress';
import { uid } from '../lib/util';
import { t } from '../i18n';

export function MessageBar({ onShow }: { onShow: (text: string) => void }) {
  const message = useStore((st) => st.message);
  const draft = useStore((st) => st.draft);
  const boardStack = useStore((st) => st.boardStack);
  const screen = useStore((st) => st.screen);
  const s = useSettings();
  const { speakMessage, backspace, clearMessage, home, back, setFormsFor, updateProfile, showToast, setScreen } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: s.reduceMotion ? 'auto' : 'smooth' });
    setSaved(false);
    if (!message.length) setMenu(false);
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
    showToast(t('Saved to Phrases ★'));
  };

  const share = async () => {
    if (!text) return;
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ text });
      else if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        showToast(t('Copied'));
      }
    } catch { /* cancelled */ }
  };

  const canBack = boardStack.length > 1 || screen !== 'talk';

  return (
    <div className="msgbar" data-scan-group>
      <button className="iconbtn nav-home" aria-label={t('Home')} data-scan-item {...homePress}><IconHome /></button>
      <button className="iconbtn nav-back" aria-label={t('Back')} data-scan-item disabled={!canBack} {...backPress}><IconBack /></button>
      <div className="msg" role="button" tabIndex={0} aria-label={text ? `Message: ${text}. Tap to speak.` : 'Message bar, empty'} {...barPress}>
        <div className="msg-words" ref={scroller}>
          {message.length === 0 && !draft && <span className="msg-placeholder">{t('Tap words to talk')}</span>}
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
            <span className="msg-tools-full">
              <button className="iconbtn small" aria-label={t('Save as phrase')} onClick={(e) => { e.stopPropagation(); savePhrase(); }} data-scan-item>
                <IconStar size={20} filled={saved} />
              </button>
              <button className="iconbtn small" aria-label={t('Share or copy text')} onClick={(e) => { e.stopPropagation(); share(); }} data-scan-item>
                <IconShare size={20} />
              </button>
              <button className="iconbtn small" aria-label={t('Show in big text')} onClick={(e) => { e.stopPropagation(); onShow(text); }} data-scan-item>
                <IconExpand size={20} />
              </button>
              <button className="iconbtn small" aria-label={t('Clear message')} onClick={(e) => { e.stopPropagation(); clearMessage(); }} data-scan-item>
                <IconClose size={20} />
              </button>
            </span>
            <button className="iconbtn small msg-tools-more" aria-label={t('More message options')} aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} data-scan-item>
              <IconMore size={22} />
            </button>
          </div>
        )}
        {menu && (message.length > 0 || !!draft) && (
          <div className="msg-menu" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} data-scan-group>
            <button className="btn" onClick={(e) => { e.stopPropagation(); savePhrase(); setMenu(false); }} data-scan-item><IconStar size={20} filled={saved} /> {t('Save phrase')}</button>
            <button className="btn" onClick={(e) => { e.stopPropagation(); share(); setMenu(false); }} data-scan-item><IconShare size={20} /> {t('Share / copy')}</button>
            <button className="btn" onClick={(e) => { e.stopPropagation(); onShow(text); setMenu(false); }} data-scan-item><IconExpand size={20} /> {t('Big text')}</button>
            <button className="btn" onClick={(e) => { e.stopPropagation(); clearMessage(); setMenu(false); }} data-scan-item><IconClose size={20} /> {t('Clear')}</button>
          </div>
        )}
      </div>
      <button className="iconbtn nav-bs" aria-label={t('Delete last word (hold to clear)')} data-scan-item {...bsPress}><IconBackspace /></button>
      <button className="speakbtn" aria-label={t('Speak')} data-scan-item {...speakPress}><IconSpeak size={30} /><span>{t('Speak')}</span></button>
    </div>
  );
}
