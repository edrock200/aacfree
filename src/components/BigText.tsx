import { useRef, useState } from 'react';
import { useDialog } from './Modal';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { IconClose, IconSpeak } from './Icons';
import { PressButton } from './PressButton';
import { t } from '../i18n';

/**
 * Full-screen message to show a communication partner (noisy places, etc.).
 * It is a modal dialog: scanning stays inside it and the page behind is inert.
 */
export function BigText({ text, onClose }: { text: string; onClose: () => void }) {
  const [flip, setFlip] = useState(false);
  const { speakText } = useStore.getState();
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onClose);
  return createPortal(
    <div ref={root} className={`bigtext ${flip ? 'flip' : ''}`} onClick={onClose} role="dialog" aria-modal="true"
      aria-label={t('Big text')} tabIndex={-1} data-scan-scope>
      <p style={{ fontSize: `clamp(2rem, ${Math.max(4, 22 - text.length / 6)}vmin, 14vmin)` }}>{text}</p>
      <div className="bigtext-tools" onClick={(e) => e.stopPropagation()} data-scan-group>
        <PressButton className="btn big" onPress={() => speakText(text)} data-scan-item><IconSpeak /> {t('Speak')}</PressButton>
        <PressButton className="btn big" onPress={() => setFlip(!flip)} data-scan-item>{t('↻ Flip')}</PressButton>
        <PressButton className="btn big" onPress={onClose} data-scan-item><IconClose /> {t('Close')}</PressButton>
      </div>
    </div>,
    document.body,
  );
}
