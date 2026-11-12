import { useState } from 'react';
import { useStore } from '../../store';
import { Symbol } from '../../components/Symbol';
import { symbolFor } from '../../data/defaults';

const PARTS = ['head', 'eyes', 'ears', 'nose', 'mouth', 'teeth', 'throat', 'neck', 'chest', 'tummy', 'back', 'arm',
  'hand', 'finger', 'leg', 'knee', 'foot', 'toes', 'skin', 'bottom'];
const KW: Record<string, string> = { eyes: 'eye', ears: 'ear', teeth: 'tooth', tummy: 'belly', toes: 'toe', bottom: 'buttocks' };
const FEELS = [
  { label: 'hurts', plural: 'hurt', icon: 'pain' },
  { label: 'is itchy', plural: 'are itchy', icon: 'itchy' },
  { label: 'feels funny', plural: 'feel funny', icon: 'confused' },
  { label: 'is bleeding', plural: 'are bleeding', icon: 'blood' },
];
const PLURAL = new Set(['eyes', 'ears', 'teeth', 'toes']);

/** "Where does it hurt?" — pick a body part, then how it feels. */
export function BodyTool() {
  const { speakText } = useStore.getState();
  const [part, setPart] = useState<string | null>(null);
  return (
    <div className="body-tool">
      <p className="center muted">{part ? `My ${part}…` : 'Where?'}</p>
      {!part ? (
        <div className="sym-grid big" data-scan-group>
          {PARTS.map((pt) => (
            <button key={pt} className="sym-opt" data-scan-item onClick={() => { setPart(pt); speakText(`my ${pt}`); }}>
              <Symbol value={symbolFor(KW[pt] ?? pt)} />
              <span>{pt}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sym-grid big" data-scan-group>
          {FEELS.map((f) => (
            <button key={f.label} className="sym-opt" data-scan-item onClick={() => speakText(`My ${part} ${PLURAL.has(part) ? f.plural : f.label}.`)}>
              <Symbol value={symbolFor(f.icon)} />
              <span>{PLURAL.has(part) ? f.plural : f.label}</span>
            </button>
          ))}
          <button className="sym-opt" data-scan-item onClick={() => setPart(null)}><span className="big">↩</span><span>other place</span></button>
        </div>
      )}
    </div>
  );
}
