import { useState } from 'react';
import { useStore, type PickedItem } from '../../store';
import { Symbol } from '../../components/Symbol';
import { PressButton } from '../../components/PressButton';
import { VocabPicker } from '../../components/VocabPicker';
import { IconSpeak } from '../../components/Icons';
import { t, ts } from '../../i18n';

export function FirstThenTool() {
  const { speakText, setFirstThen } = useStore.getState();
  const { first, then, firstDone } = useStore((st) => st.firstThen);
  const [picking, setPicking] = useState<'first' | 'then' | null>(null);
  const setFirstDone = (firstDone: boolean) => setFirstThen({ firstDone });

  const say = () => {
    if (first && then) speakText(ts('First {v0}, then {v1}.', { v0: first.label, v1: then.label }));
  };

  const slot = (which: 'first' | 'then', item: PickedItem | null) => (
    <PressButton className={`ft-slot ${which} ${which === 'first' && firstDone ? 'done' : ''}`} data-scan-item
      onPress={() => (item ? speakText(item.label) : setPicking(which))}>
      <small>{which === 'first' ? 'First' : 'Then'}</small>
      {item ? <><Symbol value={item.symbol} /><b>{item.label}</b></> : <span className="muted">{t('Tap to choose')}</span>}
    </PressButton>
  );

  return (
    <div className="firstthen">
      <div className="ft-row" data-scan-group>
        {slot('first', first)}
        <span className="ft-arrow">➜</span>
        {slot('then', then)}
      </div>
      <div className="row-center" data-scan-group>
        <PressButton className="btn primary" disabled={!first || !then} onPress={say} data-scan-item><IconSpeak /> {t('Say it')}</PressButton>
        {first && <PressButton className="btn" onPress={() => { setFirstDone(!firstDone); if (!firstDone && then) speakText(ts('{v0} is done. Now {v1}!', { v0: first.label, v1: then.label })); }} data-scan-item>{firstDone ? t('Undo done') : t('✓ {v0} done', { v0: first.label })}</PressButton>}
        <PressButton className="btn" onPress={() => setPicking('first')} data-scan-item>{t('Change first')}</PressButton>
        <PressButton className="btn" onPress={() => setPicking('then')} data-scan-item>{t('Change then')}</PressButton>
      </div>
      {picking && (
        <VocabPicker title={picking === 'first' ? t('First…') : t('Then…')} onClose={() => setPicking(null)}
          onPick={(it) => { setFirstThen(picking === 'first' ? { first: it, firstDone: false } : { then: it, firstDone: false }); setPicking(null); }} />
      )}
    </div>
  );
}
