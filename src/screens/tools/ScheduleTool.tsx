import { useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Symbol } from '../../components/Symbol';
import { VocabPicker } from '../../components/VocabPicker';
import { IconCheck, IconPlus, IconTrash, IconBack, IconEdit, IconTimer } from '../../components/Icons';
import { Modal } from '../../components/Modal';
import { SymbolPicker } from '../../components/SymbolPicker';
import type { ScheduleStep } from '../../types';
import { uid } from '../../lib/util';
import { t, ts } from '../../i18n';

/** Visual schedule: steps with pictures, Now / Next, tap to mark done. */
export function ScheduleTool() {
  const p = useProfile();
  const unlocked = useStore((st) => st.unlocked);
  const { updateProfile, speakText } = useStore.getState();
  const [sid, setSid] = useState<string | undefined>(p.schedules[0]?.id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
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
    return <div className="center"><p>{t('No schedules yet.')}</p>{unlocked && <button className="btn primary" onClick={newSchedule}><IconPlus /> {t('New schedule')}</button>}</div>;
  }

  const nowIndex = sched.steps.findIndex((x) => !x.done);

  return (
    <div className="schedule">
      <div className="tabs scroll" data-scan-group>
        {p.schedules.map((x) => (
          <button key={x.id} className={`tab ${x.id === sched.id ? 'active' : ''}`} onClick={() => setSid(x.id)} data-scan-item>{x.name}</button>
        ))}
        {unlocked && <button className="tab add" onClick={newSchedule}><IconPlus size={18} /> {t('New')}</button>}
      </div>
      {unlocked && (
        <div className="row">
          <input className="inline-input" value={sched.name} onChange={(e) => updateProfile((pp) => { pp.schedules.find((x) => x.id === sched.id)!.name = e.target.value; })} aria-label={t('Schedule name')} />
          <button className="btn small" onClick={() => mutate((st) => st.forEach((x) => (x.done = false)))}>{t('Reset')}</button>
          <button className="btn small" onClick={() => {
            const id = uid('s');
            updateProfile((pp) => { pp.schedules.push({ id, name: `${sched.name} (copy)`, steps: sched.steps.map((x) => ({ ...x, id: uid('st'), done: false })) }); });
            setSid(id);
          }}>{t('Duplicate')}</button>
          <button className="btn small danger-outline" onClick={() => { updateProfile((pp) => { pp.schedules = pp.schedules.filter((x) => x.id !== sched.id); }); setSid(undefined); }}><IconTrash size={18} /> {t('Delete')}</button>
        </div>
      )}
      {nowIndex >= 0 && (
        <div className="now-next">
          <div className="nn now"><small>{t('Now')}</small><Symbol value={sched.steps[nowIndex].symbol} /><b>{sched.steps[nowIndex].label}</b>
            {sched.steps[nowIndex].minutes ? (
              <button className="btn small" data-scan-item onClick={() => {
                const m = sched.steps[nowIndex].minutes!;
                useStore.getState().setTimer({ total: m * 60, left: m * 60, endAt: Date.now() + m * 60000 });
                useStore.getState().setTool('timer');
              }}><IconTimer size={18} /> {sched.steps[nowIndex].minutes} min timer</button>
            ) : null}
          </div>
          {sched.steps[nowIndex + 1] && <div className="nn next"><small>{t('Next')}</small><Symbol value={sched.steps[nowIndex + 1].symbol} /><b>{sched.steps[nowIndex + 1].label}</b></div>}
        </div>
      )}
      {nowIndex < 0 && sched.steps.length > 0 && (
        <div className="all-done">{t('🎉 All done!')} <button className="btn" onClick={() => mutate((st) => st.forEach((x) => (x.done = false)))}>{t('Start again')}</button></div>
      )}
      <ol className="steps" data-scan-group>
        {sched.steps.map((st, i) => (
          <li key={st.id} className={`step ${st.done ? 'done' : ''} ${i === nowIndex ? 'current' : ''}`}>
            <button className="step-main" data-scan-item onClick={() => { speakText(st.label); }} aria-label={st.label}>
              <Symbol value={st.symbol} />
              <span>{st.label}{st.minutes ? <small className="muted"> · {st.minutes} min</small> : null}</span>
            </button>
            <button className="iconbtn check" data-scan-item aria-label={st.done ? 'Mark not done' : 'Mark done'} onClick={() => {
              mutate((steps) => { steps[i].done = !steps[i].done; });
              if (!st.done) speakText(ts('{v0}, finished!', { v0: st.label }));
            }}>
              <IconCheck />
            </button>
            {unlocked && (
              <span className="step-edit">
                <button className="iconbtn small" aria-label={t('Move up')} disabled={i === 0} onClick={() => mutate((s) => { [s[i - 1], s[i]] = [s[i], s[i - 1]]; })}><IconBack style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="iconbtn small" aria-label={t('Edit step')} onClick={() => setEditing(i)}><IconEdit size={18} /></button>
                <button className="iconbtn small" aria-label={t('Remove step')} onClick={() => mutate((s) => { s.splice(i, 1); })}><IconTrash size={18} /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {unlocked && <button className="btn primary" onClick={() => setAdding(true)}><IconPlus /> {t('Add step')}</button>}
      {!unlocked && sched.steps.length === 0 && <p className="muted">A grown-up can add steps (unlock Grown-ups first).</p>}
      {editing !== null && sched.steps[editing] && (
        <StepEditor step={sched.steps[editing]} onClose={() => setEditing(null)}
          onSave={(st) => { mutate((steps) => { steps[editing] = st; }); setEditing(null); }} />
      )}
      {adding && <VocabPicker title={t('Add a step')} onClose={() => setAdding(false)} onPick={(it) => {
        mutate((s) => { s.push({ id: uid('st'), label: it.label, symbol: it.symbol }); });
        setAdding(false);
      }} />}
    </div>
  );
}

function StepEditor({ step, onSave, onClose }: { step: ScheduleStep; onSave: (s: ScheduleStep) => void; onClose: () => void }) {
  const [st, setSt] = useState(step);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Modal title={t('Edit step')} onClose={onClose}
        footer={<><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary" disabled={!st.label.trim()} onClick={() => onSave({ ...st, label: st.label.trim() })}>{t('Save')}</button></>}>
        <div className="cat-editor">
          <button className="sym-opt preview" onClick={() => setPicking(true)} aria-label={t('Choose picture')}>
            {st.symbol ? <Symbol value={st.symbol} /> : <IconPlus size={40} />}
            <span>{st.symbol ? 'Change picture' : 'Add picture'}</span>
          </button>
          <div className="grow">
            <label className="field"><span>{t('Step')}</span><input value={st.label} onChange={(e) => setSt({ ...st, label: e.target.value })} /></label>
            <label className="field"><span>How long? (minutes, optional)</span>
              <input type="number" min={0} max={240} value={st.minutes ?? ''} onChange={(e) => setSt({ ...st, minutes: Number(e.target.value) || undefined })} />
            </label>
          </div>
        </div>
      </Modal>
      {picking && <SymbolPicker initialQuery={st.label} onClose={() => setPicking(false)} onPick={(symbol) => { setSt({ ...st, symbol }); setPicking(false); }} />}
    </>
  );
}
