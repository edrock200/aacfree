import { useState } from 'react';
import { useStore } from '../../store';
import { Symbol } from '../../components/Symbol';
import { VocabPicker, type PickedItem } from '../../components/VocabPicker';
import { IconSpeak } from '../../components/Icons';

export function FirstThenTool() {
  const { speakText } = useStore.getState();
  const [first, setFirst] = useState<PickedItem | null>(null);
  const [then, setThen] = useState<PickedItem | null>(null);
  const [picking, setPicking] = useState<'first' | 'then' | null>(null);
  const [firstDone, setFirstDone] = useState(false);

  const say = () => {
    if (first && then) speakText(`First ${first.label}, then ${then.label}.`);
  };

  const slot = (which: 'first' | 'then', item: PickedItem | null) => (
    <button className={`ft-slot ${which} ${which === 'first' && firstDone ? 'done' : ''}`} data-scan-item
      onClick={() => (item ? speakText(item.label) : setPicking(which))}>
      <small>{which === 'first' ? 'First' : 'Then'}</small>
      {item ? <><Symbol value={item.symbol} /><b>{item.label}</b></> : <span className="muted">Tap to choose</span>}
    </button>
  );

  return (
    <div className="firstthen">
      <div className="ft-row" data-scan-group>
        {slot('first', first)}
        <span className="ft-arrow">➜</span>
        {slot('then', then)}
      </div>
      <div className="row-center" data-scan-group>
        <button className="btn primary" disabled={!first || !then} onClick={say} data-scan-item><IconSpeak /> Say it</button>
        {first && <button className="btn" onClick={() => { setFirstDone(!firstDone); if (!firstDone && then) speakText(`${first.label} is done. Now ${then.label}!`); }} data-scan-item>{firstDone ? 'Undo done' : `✓ ${first.label} done`}</button>}
        <button className="btn" onClick={() => setPicking('first')} data-scan-item>Change first</button>
        <button className="btn" onClick={() => setPicking('then')} data-scan-item>Change then</button>
      </div>
      {picking && (
        <VocabPicker title={picking === 'first' ? 'First…' : 'Then…'} onClose={() => setPicking(null)}
          onPick={(it) => { (picking === 'first' ? setFirst : setThen)(it); setFirstDone(false); setPicking(null); }} />
      )}
    </div>
  );
}
