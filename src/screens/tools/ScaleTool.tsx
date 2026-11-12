import { useState } from 'react';
import { useStore } from '../../store';

const FEELINGS = [
  { n: 1, face: '😌', label: 'Calm', say: 'I feel calm.', color: '#8fd19e' },
  { n: 2, face: '🙂', label: 'A little', say: 'I feel a little upset.', color: '#c8e07a' },
  { n: 3, face: '😕', label: 'Medium', say: 'I feel upset.', color: '#ffd166' },
  { n: 4, face: '😣', label: 'Big', say: 'I feel very upset. I need help.', color: '#ff9f5a' },
  { n: 5, face: '😫', label: 'Huge', say: 'My feeling is too big. I need a break right now.', color: '#ff6b6b' },
];

const PAIN = [
  { n: 0, face: '😀', label: 'No hurt' },
  { n: 2, face: '🙂', label: 'Hurts a little' },
  { n: 4, face: '😐', label: 'Hurts a bit more' },
  { n: 6, face: '🙁', label: 'Hurts even more' },
  { n: 8, face: '😣', label: 'Hurts a lot' },
  { n: 10, face: '😭', label: 'Hurts worst' },
];
const PAIN_COLORS = ['#8fd19e', '#c8e07a', '#ffd166', '#ffb35a', '#ff8a5a', '#ff5c5c'];

export function ScaleTool({ kind }: { kind: 'feelings' | 'pain' }) {
  const { speakText } = useStore.getState();
  const [sel, setSel] = useState<number | null>(null);

  if (kind === 'feelings') {
    return (
      <div className="scale">
        <p className="center muted">How big is the feeling?</p>
        <div className="scale-col" data-scan-group>
          {[...FEELINGS].reverse().map((f) => (
            <button key={f.n} className={`scale-btn ${sel === f.n ? 'on' : ''}`} style={{ background: f.color }} data-scan-item
              onClick={() => { setSel(f.n); speakText(f.say); }}>
              <span className="scale-n">{f.n}</span><span className="scale-face">{f.face}</span><b>{f.label}</b>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="scale">
      <p className="center muted">How much does it hurt?</p>
      <div className="scale-row" data-scan-group>
        {PAIN.map((f, i) => (
          <button key={f.n} className={`scale-btn vertical ${sel === f.n ? 'on' : ''}`} style={{ background: PAIN_COLORS[i] }} data-scan-item
            onClick={() => { setSel(f.n); speakText(f.n === 0 ? 'It does not hurt.' : `My pain is ${f.n} out of 10. It ${f.label.toLowerCase()}.`); }}>
            <span className="scale-face">{f.face}</span><span className="scale-n">{f.n}</span><b>{f.label}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
