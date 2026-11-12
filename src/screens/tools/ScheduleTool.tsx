import { useEffect, useState } from 'react';
import { useStore, useProfile } from '../../store';
import { Symbol } from '../../components/Symbol';
import { VocabPicker } from '../../components/VocabPicker';
import { IconCheck, IconPlus, IconTrash, IconBack, IconEdit, IconTimer } from '../../components/Icons';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SymbolPicker } from '../../components/SymbolPicker';
import { PersonButton } from '../talkControls';
import type { Schedule, ScheduleStep } from '../../types';
import { addSnapshot } from '../../lib/db';
import { localDay, resetStaleTicks } from '../../lib/talk';
import { uid } from '../../lib/util';
import { t, ts } from '../../i18n';

/** Clears yesterday's ticks (on open, and every minute while open, e.g. across midnight). */
function useDailyReset() {
  useEffect(() => {
    const check = () => {
      const st = useStore.getState();
      const next = resetStaleTicks(st.profile().schedules, localDay());
      if (next) st.updateProfile((pp) => { pp.schedules = next; }, { shallow: true });
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);
}

/** Visual schedule: steps with pictures, Now / Next, tap to mark done. */
export function ScheduleTool() {
  const p = useProfile();
  const s = p.settings;
  const unlocked = useStore((st) => st.unlocked);
  const contentEdit = useStore((st) => st.contentEdit);
  // Editing needs Grown-ups unlocked AND the Edit pencil on; ticking and speaking work for everyone.
  const edit = unlocked && contentEdit;
  const { updateProfile, speakText, showToast } = useStore.getState();
  const [sid, setSid] = useState<string | undefined>(p.schedules[0]?.id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sched = p.schedules.find((x) => x.id === sid) ?? p.schedules[0];
  useDailyReset();

  const mutate = (fn: (steps: NonNullable<typeof sched>['steps']) => void, tick = false) =>
    updateProfile((pp) => {
      const s = pp.schedules.find((x) => x.id === sched!.id);
      if (!s) return;
      fn(s.steps);
      if (tick) s.tickedOn = localDay();
    });

  const resetTicks = () => mutate((st) => st.forEach((x) => (x.done = false)));

  const newSchedule = () => {
    const id = uid('s');
    updateProfile((pp) => { pp.schedules.push({ id, name: `${t('Schedule')} ${pp.schedules.length + 1}`, steps: [] }); });
    setSid(id);
  };

  const deleteSchedule = (victim: Schedule) => {
    const index = p.schedules.findIndex((x) => x.id === victim.id);
    addSnapshot(useStore.getState().data, 'Before deleting a schedule').catch(() => {});
    updateProfile((pp) => { pp.schedules = pp.schedules.filter((x) => x.id !== victim.id); });
    setSid(undefined);
    showToast(t('Schedule deleted'), {
      label: 'Undo',
      run: () => {
        updateProfile((pp) => {
          if (!pp.schedules.some((x) => x.id === victim.id)) pp.schedules.splice(Math.max(0, index), 0, victim);
        });
        setSid(victim.id);
      },
    });
  };

  const removeStep = (i: number) => {
    const step = sched!.steps[i];
    const schedId = sched!.id;
    mutate((st) => { st.splice(i, 1); });
    showToast(t('Step removed'), {
      label: 'Undo',
      run: () => updateProfile((pp) => {
        const target = pp.schedules.find((x) => x.id === schedId);
        if (target && !target.steps.some((x) => x.id === step.id)) target.steps.splice(Math.min(i, target.steps.length), 0, step);
      }),
    });
  };

  if (!sched) {
    return <div className="center"><p>{t('No schedules yet.')}</p>{unlocked && <button className="btn primary" onClick={newSchedule}><IconPlus /> {t('New schedule')}</button>}</div>;
  }

  const nowIndex = sched.steps.findIndex((x) => !x.done);
  const anyTicked = sched.steps.some((x) => x.done);

  return (
    <div className="schedule">
      <div className="tabs scroll" data-scan-group>
        {p.schedules.map((x) => (
          <PersonButton key={x.id} s={s} className={`tab ${x.id === sched.id ? 'active' : ''}`} onPress={() => setSid(x.id)}>{x.name}</PersonButton>
        ))}
        {edit && <button className="tab add" onClick={newSchedule}><IconPlus size={18} /> {t('New')}</button>}
      </div>
      {edit && (
        <div className="row">
          <input className="inline-input" value={sched.name} onChange={(e) => updateProfile((pp) => { pp.schedules.find((x) => x.id === sched.id)!.name = e.target.value; })} aria-label={t('Schedule name')} />
          <button className="btn small" onClick={() => {
            const id = uid('s');
            updateProfile((pp) => { pp.schedules.push({ id, name: `${sched.name} (copy)`, steps: sched.steps.map((x) => ({ ...x, id: uid('st'), done: false })) }); });
            setSid(id);
          }}>{t('Duplicate')}</button>
          <button className="btn small danger-outline" onClick={() => setConfirmDelete(true)}><IconTrash size={18} /> {t('Delete')}</button>
        </div>
      )}
      {anyTicked && nowIndex >= 0 && (
        <div className="row" data-scan-group>
          <PersonButton s={s} className="btn small" onPress={resetTicks}>{t('Reset')}</PersonButton>
        </div>
      )}
      {nowIndex >= 0 && (
        <div className="now-next" data-scan-group>
          <div className="nn now"><small>{t('Now')}</small><Symbol value={sched.steps[nowIndex].symbol} /><b>{sched.steps[nowIndex].label}</b>
            {sched.steps[nowIndex].minutes ? (
              <PersonButton s={s} className="btn small" onPress={() => {
                const m = sched.steps[nowIndex].minutes!;
                useStore.getState().setTimer({ total: m * 60, left: m * 60, endAt: Date.now() + m * 60000 });
                useStore.getState().setTool('timer');
              }}><IconTimer size={18} /> {t('{v0} min timer', { v0: sched.steps[nowIndex].minutes })}</PersonButton>
            ) : null}
          </div>
          {sched.steps[nowIndex + 1] && <div className="nn next"><small>{t('Next')}</small><Symbol value={sched.steps[nowIndex + 1].symbol} /><b>{sched.steps[nowIndex + 1].label}</b></div>}
        </div>
      )}
      {nowIndex < 0 && sched.steps.length > 0 && (
        <div className="all-done" data-scan-group>{t('🎉 All done!')} <PersonButton s={s} className="btn" onPress={resetTicks}>{t('Start again')}</PersonButton></div>
      )}
      <ol className="steps" data-scan-group>
        {sched.steps.map((st, i) => (
          <li key={st.id} className={`step ${st.done ? 'done' : ''} ${i === nowIndex ? 'current' : ''}`}>
            <PersonButton s={s} className="step-main" label={st.label} onPress={() => { speakText(st.label); }}>
              <Symbol value={st.symbol} />
              <span>{st.label}{st.minutes ? <small className="muted"> · {st.minutes} min</small> : null}</span>
            </PersonButton>
            <PersonButton s={s} className="iconbtn check" label={st.done ? t('Mark not done') : t('Mark done')} onPress={() => {
              mutate((steps) => { steps[i].done = !steps[i].done; }, true);
              if (!st.done) speakText(ts('{v0}, finished!', { v0: st.label }));
            }}>
              <IconCheck />
            </PersonButton>
            {edit && (
              <span className="step-edit">
                <button className="iconbtn small" aria-label={t('Move up')} disabled={i === 0} onClick={() => mutate((s) => { [s[i - 1], s[i]] = [s[i], s[i - 1]]; })}><IconBack style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="iconbtn small" aria-label={t('Edit step')} onClick={() => setEditing(i)}><IconEdit size={18} /></button>
                <button className="iconbtn small" aria-label={t('Remove step')} onClick={() => removeStep(i)}><IconTrash size={18} /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {edit && <button className="btn primary" onClick={() => setAdding(true)}><IconPlus /> {t('Add step')}</button>}
      {!edit && sched.steps.length === 0 && <p className="muted">{t('A grown-up can add steps: unlock Grown-ups, then tap Edit.')}</p>}
      {editing !== null && sched.steps[editing] && (
        <StepEditor step={sched.steps[editing]} onClose={() => setEditing(null)}
          onSave={(st) => { mutate((steps) => { steps[editing] = st; }); setEditing(null); }} />
      )}
      {adding && <VocabPicker title={t('Add a step')} onClose={() => setAdding(false)} onPick={(it) => {
        mutate((s) => { s.push({ id: uid('st'), label: it.label, symbol: it.symbol }); });
        setAdding(false);
      }} />}
      {confirmDelete && (
        <ConfirmDialog title={t('Delete the schedule “{v0}”?', { v0: sched.name })} onClose={() => setConfirmDelete(false)} onConfirm={() => deleteSchedule(sched)}>
          <p>{t('It has {v0} step(s). You can press Undo straight after.', { v0: sched.steps.length })}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function StepEditor({ step, onSave, onClose }: { step: ScheduleStep; onSave: (s: ScheduleStep) => void; onClose: () => void }) {
  const [st, setSt] = useState(step);
  const [picking, setPicking] = useState(false);
  const dirty = st.label !== step.label || st.symbol !== step.symbol || st.minutes !== step.minutes;
  return (
    <>
      <Modal title={t('Edit step')} onClose={onClose} dirty={dirty}
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
