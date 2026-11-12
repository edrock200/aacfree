import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useStore, useSettings } from '../store';
import { applyCase, joinWords } from '../lib/sentence';
import { Symbol } from './Symbol';
import { IconBack, IconBackspace, IconClose, IconExpand, IconHome, IconMore, IconShare, IconSpeak, IconStar, IconStop } from './Icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { usePress } from '../lib/usePress';
import { PressButton } from './PressButton';
import { uid } from '../lib/util';
import { t } from '../i18n';

export function MessageBar({ onShow }: { onShow: (text: string) => void }) {
  const message = useStore((st) => st.message);
  const draft = useStore((st) => st.draft);
  const boardStack = useStore((st) => st.boardStack);
  const screen = useStore((st) => st.screen);
  /** While the message is being spoken, Speak is Stop (speakMessage stops it). */
  const speaking = useStore((st) => st.speaking);
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
  // Tapping the bar itself speaks, but presses on the words and tools inside it are theirs alone.
  const onBar = <E extends SyntheticEvent<HTMLElement>>(fn: (e: E) => void) => (e: E) => {
    if (!(e.target as HTMLElement).closest('button, .msg-menu')) fn(e);
  };

  return (
    <div className="msgbar" data-scan-group>
      <button className="iconbtn nav-home" aria-label={t('Home')} data-scan-item {...homePress}><IconHome /></button>
      <button className="iconbtn nav-back" aria-label={t('Back')} data-scan-item disabled={!canBack} {...backPress}><IconBack /></button>
      {/* A group, not a button: the words and tools inside are buttons of their own. Speak is the separate speak target. */}
      <div className="msg" role="group" aria-label={text ? t('Message: {text}', { text }) : t('Message bar, empty')}
        onPointerDown={onBar(barPress.onPointerDown)} onPointerUp={onBar(barPress.onPointerUp)} onPointerMove={onBar(barPress.onPointerMove)}
        onPointerCancel={barPress.onPointerCancel} onPointerLeave={barPress.onPointerLeave} onContextMenu={barPress.onContextMenu}>
        <div className="msg-words" ref={scroller} data-scan-group>
          {message.length === 0 && !draft && <span className="msg-placeholder">{t('Tap words to talk')}</span>}
          {message.map((w, i) => (
            <PressButton
              key={w.id}
              className="msg-word"
              onPress={() => setFormsFor({ index: i })}
              aria-label={t('{word}, change word', { word: w.text })}
              data-scan-item
            >
              {s.showSymbolsInBar && w.symbol && <Symbol value={w.symbol} />}
              <span>{applyCase(w.text, s.textCase)}</span>
            </PressButton>
          ))}
          {draft && <span className="msg-word draft"><span>{draft}</span><i className="caret" /></span>}
        </div>
        {(message.length > 0 || draft) && (
          <div className="msg-tools">
            <span className="msg-tools-full">
              <PressButton className="iconbtn small" aria-label={t('Save as phrase')} onPress={savePhrase} data-scan-item>
                <IconStar size={20} filled={saved} />
              </PressButton>
              <PressButton className="iconbtn small" aria-label={t('Share or copy text')} onPress={share} data-scan-item>
                <IconShare size={20} />
              </PressButton>
              <PressButton className="iconbtn small" aria-label={t('Show in big text')} onPress={() => onShow(text)} data-scan-item>
                <IconExpand size={20} />
              </PressButton>
              <PressButton className="iconbtn small" aria-label={t('Clear message')} onPress={clearMessage} data-scan-item>
                <IconClose size={20} />
              </PressButton>
            </span>
            <PressButton className="iconbtn small msg-tools-more" aria-label={t('More message options')} aria-expanded={menu} onPress={() => setMenu(!menu)} data-scan-item>
              <IconMore size={22} />
            </PressButton>
          </div>
        )}
        {menu && (message.length > 0 || !!draft) && (
          <div className="msg-menu" data-scan-group>
            <PressButton className="btn" onPress={() => { savePhrase(); setMenu(false); }} data-scan-item><IconStar size={20} filled={saved} /> {t('Save phrase')}</PressButton>
            <PressButton className="btn" onPress={() => { share(); setMenu(false); }} data-scan-item><IconShare size={20} /> {t('Share / copy')}</PressButton>
            <PressButton className="btn" onPress={() => { onShow(text); setMenu(false); }} data-scan-item><IconExpand size={20} /> {t('Big text')}</PressButton>
            <PressButton className="btn" onPress={() => { clearMessage(); setMenu(false); }} data-scan-item><IconClose size={20} /> {t('Clear')}</PressButton>
          </div>
        )}
      </div>
      <button className="iconbtn nav-bs" aria-label={t('Delete last word (hold to clear)')} data-scan-item {...bsPress}><IconBackspace /></button>
      <button className={`speakbtn ${speaking ? 'stopping' : ''}`} aria-label={speaking ? t('Stop') : t('Speak')} data-scan-item {...speakPress}>
        {speaking ? <IconStop size={30} /> : <IconSpeak size={30} />}<span>{speaking ? t('Stop') : t('Speak')}</span>
      </button>
    </div>
  );
}
