import { useState } from 'react';
import { useStore } from '../../store';
import { PressButton } from '../../components/PressButton';
import { t, ts } from '../../i18n';

const FEELINGS = [
  { n: 1, face: '😌', label: 'Calm', say: 'I feel calm.', color: '#8fd19e' },
  { n: 2, face: '🙂', label: 'A little', say: 'I feel a little upset.', color: '#c8e07a' },
  { n: 3, face: '😕', label: 'Medium', say: 'I feel upset.', color: '#ffd166' },
  { n: 4, face: '😣', label: 'Big', say: 'I feel very upset. I need help.', color: '#ff9f5a' },
  { n: 5, face: '😫', label: 'Huge', say: 'My feeling is too big. I need a break right now.', color: '#ff6b6b' },
];

const PAIN = [
  { n: 0, face: '😀', label: 'No hurt', say: 'It does not hurt.' },
  { n: 2, face: '🙂', label: 'Hurts a little', say: 'My pain is 2 out of 10. It hurts a little.' },
  { n: 4, face: '😐', label: 'Hurts a bit more', say: 'My pain is 4 out of 10. It hurts a bit more.' },
  { n: 6, face: '🙁', label: 'Hurts even more', say: 'My pain is 6 out of 10. It hurts even more.' },
  { n: 8, face: '😣', label: 'Hurts a lot', say: 'My pain is 8 out of 10. It hurts a lot.' },
  { n: 10, face: '😭', label: 'Hurts worst', say: 'My pain is 10 out of 10. It hurts the worst.' },
];
const PAIN_COLORS = ['#8fd19e', '#c8e07a', '#ffd166', '#ffb35a', '#ff8a5a', '#ff5c5c'];

export function ScaleTool({ kind }: { kind: 'feelings' | 'pain' }) {
  const { speakText } = useStore.getState();
  const [sel, setSel] = useState<number | null>(null);

  if (kind === 'feelings') {
    return (
      <div className="scale">
        <p className="center muted">{t('How big is the feeling?')}</p>
        <div className="scale-col" data-scan-group>
          {[...FEELINGS].reverse().map((f) => (
            <PressButton key={f.n} className={`scale-btn ${sel === f.n ? 'on' : ''}`} style={{ background: f.color }} data-scan-item
              onPress={() => { setSel(f.n); speakText(ts(f.say)); }}>
              <span className="scale-n">{f.n}</span><span className="scale-face">{f.face}</span><b>{t(f.label)}</b>
            </PressButton>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="scale">
      <p className="center muted">{t('How much does it hurt?')}</p>
      <div className="scale-row" data-scan-group>
        {PAIN.map((f, i) => (
          <PressButton key={f.n} className={`scale-btn vertical ${sel === f.n ? 'on' : ''}`} style={{ background: PAIN_COLORS[i] }} data-scan-item
            onPress={() => { setSel(f.n); speakText(ts(f.say)); }}>
            <span className="scale-face">{f.face}</span><span className="scale-n">{f.n}</span><b>{t(f.label)}</b>
          </PressButton>
        ))}
      </div>
    </div>
  );
}
