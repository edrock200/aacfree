import { useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Symbol } from '../../components/Symbol';
import { VocabPicker } from '../../components/VocabPicker';
import { IconCheck, IconPlus, IconTrash, IconBack } from '../../components/Icons';
import { uid } from '../../lib/util';

/** Visual schedule: steps with pictures, Now / Next, tap to mark done. */
export function ScheduleTool() {
  const p = useProfile();
  const unlocked = useStore((st) => st.unlocked);
  const { updateProfile, speakText } = useStore.getState();
  const [sid, setSid] = useState<string | undefined>(p.schedules[0]?.id);
  const [adding, setAdding] = useState(false);
  const sched = p.schedules.find((x) => x.id === sid) ?? p.schedules[0];

  const mutate = (fn: (steps: NonNullable<typeof sched>['steps']) => void) =>
    updateProfile((pp) => {
      const s = pp.schedules.find((x) => x.id === sched!.id);
      if (s) fn(s.steps);
    });

  const newSchedule = () => {
    const id = uid('s');
    updateProfile((pp) => { pp.schedules.push({ id, name: `Schedule ${pp.schedules.length + 1}`, steps: [] }); });
    setSid(id);
  };

  if (!sched) {
    return <div className="center"><p>No schedules yet.</p>{unlocked && <button className="btn primary" onClick={newSchedule}><IconPlus /> New schedule</button>}</div>;
  }

  const nowIndex = sched.steps.findIndex((x) => !x.done);

  return (
    <div className="schedule">
      <div className="tabs scroll" data-scan-group>
        {p.schedules.map((x) => (
          <button key={x.id} className={`tab ${x.id === sched.id ? 'active' : ''}`} onClick={() => setSid(x.id)} data-scan-item>{x.name}</button>
        ))}
        {unlocked && <button className="tab add" onClick={newSchedule}><IconPlus size={18} /> New</button>}
      </div>
      {unlocked && (
        <div className="row">
          <input className="inline-input" value={sched.name} onChange={(e) => updateProfile((pp) => { pp.schedules.find((x) => x.id === sched.id)!.name = e.target.value; })} aria-label="Schedule name" />
          <button className="btn small" onClick={() => mutate((st) => st.forEach((x) => (x.done = false)))}>Reset</button>
          <button className="btn small danger-outline" onClick={() => { updateProfile((pp) => { pp.schedules = pp.schedules.filter((x) => x.id !== sched.id); }); setSid(undefined); }}><IconTrash size={18} /> Delete</button>
        </div>
      )}
      {nowIndex >= 0 && (
        <div className="now-next">
          <div className="nn now"><small>Now</small><Symbol value={sched.steps[nowIndex].symbol} /><b>{sched.steps[nowIndex].label}</b></div>
          {sched.steps[nowIndex + 1] && <div className="nn next"><small>Next</small><Symbol value={sched.steps[nowIndex + 1].symbol} /><b>{sched.steps[nowIndex + 1].label}</b></div>}
        </div>
      )}
      {nowIndex < 0 && sched.steps.length > 0 && (
        <div className="all-done">🎉 All done! <button className="btn" onClick={() => mutate((st) => st.forEach((x) => (x.done = false)))}>Start again</button></div>
      )}
      <ol className="steps" data-scan-group>
        {sched.steps.map((st, i) => (
          <li key={st.id} className={`step ${st.done ? 'done' : ''} ${i === nowIndex ? 'current' : ''}`}>
            <button className="step-main" data-scan-item onClick={() => { speakText(st.label); }} aria-label={st.label}>
              <Symbol value={st.symbol} />
              <span>{st.label}</span>
            </button>
            <button className="iconbtn check" data-scan-item aria-label={st.done ? 'Mark not done' : 'Mark done'} onClick={() => {
              mutate((steps) => { steps[i].done = !steps[i].done; });
              if (!st.done) speakText(`${st.label}, finished!`);
            }}>
              <IconCheck />
            </button>
            {unlocked && (
              <span className="step-edit">
                <button className="iconbtn small" aria-label="Move up" disabled={i === 0} onClick={() => mutate((s) => { [s[i - 1], s[i]] = [s[i], s[i - 1]]; })}><IconBack style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="iconbtn small" aria-label="Remove step" onClick={() => mutate((s) => { s.splice(i, 1); })}><IconTrash size={18} /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {unlocked && <button className="btn primary" onClick={() => setAdding(true)}><IconPlus /> Add step</button>}
      {!unlocked && sched.steps.length === 0 && <p className="muted">A grown-up can add steps (unlock Grown-ups first).</p>}
      {adding && <VocabPicker title="Add a step" onClose={() => setAdding(false)} onPick={(it) => {
        mutate((s) => { s.push({ id: uid('st'), label: it.label, symbol: it.symbol }); });
        setAdding(false);
      }} />}
    </div>
  );
}
