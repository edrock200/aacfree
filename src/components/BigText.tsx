import { useState } from 'react';
import { useEscapeToClose } from './Modal';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { IconClose, IconSpeak } from './Icons';

/** Full-screen message to show a communication partner (noisy places, etc.). */
export function BigText({ text, onClose }: { text: string; onClose: () => void }) {
  const [flip, setFlip] = useState(false);
  const { speakText } = useStore.getState();
  useEscapeToClose(onClose);
  return createPortal(
    <div className={`bigtext ${flip ? 'flip' : ''}`} onClick={onClose}>
      <p style={{ fontSize: `clamp(2rem, ${Math.max(4, 22 - text.length / 6)}vmin, 14vmin)` }}>{text}</p>
      <div className="bigtext-tools" onClick={(e) => e.stopPropagation()} data-scan-group>
        <button className="btn big" onClick={() => speakText(text)} data-scan-item><IconSpeak /> Speak</button>
        <button className="btn big" onClick={() => setFlip(!flip)} data-scan-item>↻ Flip</button>
        <button className="btn big" onClick={onClose} data-scan-item><IconClose /> Close</button>
      </div>
    </div>,
    document.body,
  );
}
