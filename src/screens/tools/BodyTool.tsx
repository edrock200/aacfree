import { useState } from 'react';
import { useStore } from '../../store';
import { PressButton } from '../../components/PressButton';
import { Symbol } from '../../components/Symbol';
import { symbolFor } from '../../data/defaults';
import { getLang, pack, t } from '../../i18n';
import type { BodyFeel } from '../../i18n/packs';

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

// Other languages phrase body parts differently ("Me duele la cabeza", "J'ai mal à la tête"), so packs supply the wording.
const body = () => (getLang() === 'en' ? undefined : pack().body);
const partName = (pt: string) => body()?.part(pt) ?? pt;
const feelName = (f: { label: string; plural: string }, pt: string) => body()?.feel(f.label as BodyFeel) ?? (PLURAL.has(pt) ? f.plural : f.label);
const sentence = (pt: string, f: { label: string; plural: string }) => body()?.say(pt, f.label as BodyFeel) ?? `My ${pt} ${PLURAL.has(pt) ? f.plural : f.label}.`;

export function BodyTool() {
  const { speakText } = useStore.getState();
  const [part, setPart] = useState<string | null>(null);
  return (
    <div className="body-tool">
      <p className="center muted">{part ? (body() ? `${partName(part)}…` : `My ${part}…`) : t('Where?')}</p>
      {!part ? (
        <div className="sym-grid big" data-scan-group>
          {PARTS.map((pt) => (
            <PressButton key={pt} className="sym-opt" data-scan-item onPress={() => { setPart(pt); speakText(body() ? partName(pt) : `my ${pt}`); }}>
              <Symbol value={symbolFor(KW[pt] ?? pt)} />
              <span>{partName(pt)}</span>
            </PressButton>
          ))}
        </div>
      ) : (
        <div className="sym-grid big" data-scan-group>
          {FEELS.map((f) => (
            <PressButton key={f.label} className="sym-opt" data-scan-item onPress={() => speakText(sentence(part, f))}>
              <Symbol value={symbolFor(f.icon)} />
              <span>{feelName(f, part)}</span>
            </PressButton>
          ))}
          <PressButton className="sym-opt" data-scan-item onPress={() => setPart(null)}><span className="big">↩</span><span>{t('other place')}</span></PressButton>
        </div>
      )}
    </div>
  );
}
