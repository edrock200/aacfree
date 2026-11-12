import { useState } from 'react';
import { useStore } from '../../store';
import { Symbol } from '../../components/Symbol';
import { symbolFor } from '../../data/defaults';
import { getLang, t } from '../../i18n';

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

// Spanish needs articles and verb agreement: "Me duele la cabeza", "Me duelen los ojos".
const ES_PART: Record<string, [string, string]> = {
  head: ['cabeza', 'la cabeza'], eyes: ['ojos', 'los ojos'], ears: ['oídos', 'los oídos'], nose: ['nariz', 'la nariz'],
  mouth: ['boca', 'la boca'], teeth: ['dientes', 'los dientes'], throat: ['garganta', 'la garganta'], neck: ['cuello', 'el cuello'],
  chest: ['pecho', 'el pecho'], tummy: ['panza', 'la panza'], back: ['espalda', 'la espalda'], arm: ['brazo', 'el brazo'],
  hand: ['mano', 'la mano'], finger: ['dedo', 'el dedo'], leg: ['pierna', 'la pierna'], knee: ['rodilla', 'la rodilla'],
  foot: ['pie', 'el pie'], toes: ['dedos del pie', 'los dedos del pie'], skin: ['piel', 'la piel'], bottom: ['pompis', 'las pompis'],
};
const ES_FEEL: Record<string, [string, string, string]> = {
  // label, singular sentence, plural sentence
  hurts: ['duele', 'Me duele {p}.', 'Me duelen {p}.'],
  'is itchy': ['pica', 'Me pica {p}.', 'Me pican {p}.'],
  'feels funny': ['se siente raro', 'Siento algo raro en {p}.', 'Siento algo raro en {p}.'],
  'is bleeding': ['sangra', 'Me sangra {p}.', 'Me sangran {p}.'],
};
const es = () => getLang() === 'es';
const partName = (pt: string) => (es() ? ES_PART[pt]?.[0] ?? pt : pt);
const sentence = (pt: string, f: { label: string; plural: string }) => {
  if (es()) {
    const e = ES_FEEL[f.label];
    const plural = ES_PART[pt]?.[1].startsWith('los ') || ES_PART[pt]?.[1].startsWith('las ');
    return (plural ? e[2] : e[1]).replace('{p}', ES_PART[pt]?.[1] ?? pt);
  }
  return `My ${pt} ${PLURAL.has(pt) ? f.plural : f.label}.`;
};

/** "Where does it hurt?" — pick a body part, then how it feels. */
export function BodyTool() {
  const { speakText } = useStore.getState();
  const [part, setPart] = useState<string | null>(null);
  return (
    <div className="body-tool">
      <p className="center muted">{part ? (es() ? `${ES_PART[part]?.[1] ?? part}…` : `My ${part}…`) : t('Where?')}</p>
      {!part ? (
        <div className="sym-grid big" data-scan-group>
          {PARTS.map((pt) => (
            <button key={pt} className="sym-opt" data-scan-item onClick={() => { setPart(pt); speakText(es() ? ES_PART[pt]?.[1] ?? pt : `my ${pt}`); }}>
              <Symbol value={symbolFor(KW[pt] ?? pt)} />
              <span>{partName(pt)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sym-grid big" data-scan-group>
          {FEELS.map((f) => (
            <button key={f.label} className="sym-opt" data-scan-item onClick={() => speakText(sentence(part, f))}>
              <Symbol value={symbolFor(f.icon)} />
              <span>{es() ? ES_FEEL[f.label][0] : PLURAL.has(part) ? f.plural : f.label}</span>
            </button>
          ))}
          <button className="sym-opt" data-scan-item onClick={() => setPart(null)}><span className="big">↩</span><span>{t('other place')}</span></button>
        </div>
      )}
    </div>
  );
}
