import { useState } from 'react';
import { useStore } from '../../store';
import { Symbol } from '../../components/Symbol';
import { VocabPicker, type PickedItem } from '../../components/VocabPicker';
import { IconPlus, IconClose } from '../../components/Icons';

/** Quick choice board: a grown-up (or the person) sets up 2–6 options. */
export function ChoiceTool() {
  const { speakText } = useStore.getState();
  const [items, setItems] = useState<PickedItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [setup, setSetup] = useState(true);

  return (
    <div className="choice">
      <div className={`choice-grid n${Math.max(2, items.length)}`} data-scan-group>
        {items.map((it, i) => (
          <div key={i} className="choice-wrap">
            <button className={`choice-btn ${chosen === i ? 'on' : ''}`} data-scan-item
              onClick={() => { if (!setup) { setChosen(i); speakText(`I choose ${it.label}.`); } }}>
              <Symbol value={it.symbol} />
              <b>{it.label}</b>
            </button>
            {setup && <button className="iconbtn remove" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><IconClose /></button>}
          </div>
        ))}
        {setup && items.length < 6 && (
          <button className="choice-btn add" onClick={() => setPicking(true)}><IconPlus size={40} /><b>Add option</b></button>
        )}
      </div>
      <div className="row-center" data-scan-group>
        {setup ? (
          <button className="btn primary big" disabled={items.length < 2} onClick={() => { setSetup(false); setChosen(null); speakText('Which one do you want?'); }} data-scan-item>Ready – offer choices</button>
        ) : (
          <button className="btn" onClick={() => setSetup(true)} data-scan-item>Change options</button>
        )}
      </div>
      {picking && <VocabPicker title="Add an option" onClose={() => setPicking(false)} onPick={(it) => { setItems([...items, it]); setPicking(false); }} />}
    </div>
  );
}
