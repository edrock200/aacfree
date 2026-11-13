import { useState } from 'react';
import { useStore } from '../../store';
import { PressButton } from '../../components/PressButton';
import { t, ts } from '../../i18n';

// Intensity never identifies the emotion or adds a request the person did not choose.
const FEELINGS = [
  { n: 1, label: 'Very small', say: 'This feeling is very small.' },
  { n: 2, label: 'Small', say: 'This feeling is small.' },
  { n: 3, label: 'Medium', say: 'This feeling is medium.' },
  { n: 4, label: 'Big', say: 'This feeling is big.' },
  { n: 5, label: 'Very big', say: 'This feeling is very big.' },
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
            // A neutral visual size cue: the tint deepens and the meter fills with the level, without implying a good or bad feeling.
            <PressButton key={f.n} className={`scale-btn intensity ${sel === f.n ? 'on' : ''}`} style={{ ['--level' as string]: f.n }} aria-pressed={sel === f.n} data-scan-item
              onPress={() => { setSel(f.n); speakText(ts(f.say)); }}>
              <span className="scale-n">{f.n}</span><b>{t(f.label)}</b>
              <span className="scale-meter" aria-hidden="true">{FEELINGS.map((x) => <i key={x.n} className={x.n <= f.n ? 'full' : ''} />)}</span>
            </PressButton>
          ))}
        </div>
        <div className="row-center" data-scan-group>
          <PressButton className="btn" data-scan-item onPress={() => { setSel(null); speakText(ts("I don’t know how strong this feeling is.")); }}>{t('Not sure')}</PressButton>
          <PressButton className="btn" data-scan-item onPress={() => speakText(ts('I need help.'))}>{t('I need help.')}</PressButton>
          <PressButton className="btn" data-scan-item onPress={() => speakText(ts('I need a break.'))}>{t('I need a break.')}</PressButton>
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
