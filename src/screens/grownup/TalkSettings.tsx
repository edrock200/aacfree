import { useStore, useProfile, type ContentTarget } from '../../store';
import { Choice, Section, Toggle } from './controls';
import { TOOLS, ATTENTION_TOOL } from '../ToolsScreen';
import { toolShown } from '../../lib/talk';
import { IconChat, IconEdit, IconPerson, IconTimer, IconTrash } from '../../components/Icons';
import type { Settings } from '../../types';
import { t } from '../../i18n';

/** Settings → Boards: jump straight to editing phrases, schedules or About me (stays unlocked). */
export function QuickEdits() {
  const { openContentEditor } = useStore.getState();
  const go = (target: ContentTarget) => openContentEditor(target);
  return (
    <Section title={t('Edit other things')} intro={t('Phrases, schedules and About me are edited where they are used. These buttons take you there with editing switched on. Settings stay unlocked until you lock it.')}>
      <div className="row quick-edits">
        <button className="btn" onClick={() => go('phrases')}><IconChat /> {t('Edit phrases')}</button>
        <button className="btn" onClick={() => go('schedule')}><IconTimer /> {t('Edit schedules')}</button>
        <button className="btn" onClick={() => go('aboutme')}><IconPerson /> {t('Edit About me')}</button>
      </div>
    </Section>
  );
}

/** Settings → Display: choose which tools appear in the Tools menu. */
export function ToolsShownSection() {
  const p = useProfile();
  const { updateSettings, updateProfile } = useStore.getState();
  const hidden = Array.isArray(p.settings.hiddenTools) ? p.settings.hiddenTools : [];
  const setShown = (id: string, on: boolean) => {
    if (id === 'aboutme') {
      // About me has its own switch (aboutMe.enabled); keep the two in step.
      updateProfile((pp) => { pp.aboutMe = { ...pp.aboutMe, enabled: on }; }, { shallow: true });
    }
    const next = on ? hidden.filter((x) => x !== id) : [...new Set([...hidden, id])];
    updateSettings({ hiddenTools: next });
  };
  const all = [...TOOLS.map((x) => ({ id: x.id, name: x.name })), ATTENTION_TOOL];
  return (
    <Section title={t('Tools shown')} intro={t('Hide tools the person does not use, so the Tools menu stays simple. Hidden tools keep their contents.')}>
      {all.map((x) => (
        <Toggle key={x.id} label={t(x.name)} checked={toolShown(p, x.id)} onChange={(on) => setShown(x.id, on)} />
      ))}
    </Section>
  );
}

/** Settings → Insights: how long Recent sentences are kept. */
export function RecentSection() {
  const p = useProfile();
  const s = p.settings;
  const { updateSettings, clearRecent } = useStore.getState();
  const setKeep = (keepRecent: Settings['keepRecent']) => {
    updateSettings({ keepRecent });
    // "Don't keep" also forgets what is there now (Undo is offered).
    if (keepRecent === 'off') clearRecent();
  };
  return (
    <Section title={t('Recent sentences')} intro={t('Phrases → Recent lists the last sentences spoken, so they can be said again quickly. The person can delete them, clear them or turn on “Private for now” without the settings lock.')}>
      <Choice label={t('Keep recent sentences')} value={s.keepRecent ?? 'on'} onChange={setKeep}
        options={[
          { value: 'on', label: t('Always') },
          { value: 'session', label: t('Until AACFree restarts') },
          { value: 'off', label: t("Don't keep") },
        ]} />
      <div className="row">
        <button className="btn danger-outline" disabled={!p.history.length} onClick={clearRecent}><IconTrash size={18} /> {t('Clear recent')}</button>
      </div>
    </Section>
  );
}

/** Settings → Voice: the person's own "My voice" controls. */
export function MyVoiceSettings() {
  const p = useProfile();
  const { updateSettings, setScreen, setTool } = useStore.getState();
  return (
    <Section title={t('My voice (for the person)')} intro={t('Tools → My voice lets the person choose how loud and how fast AACFree speaks, or show messages in big letters instead of speaking. It is never locked. While a message is being spoken, the Speak button becomes Stop.')}>
      <Toggle label={t("Show, don't speak")} hint={t('Messages open in Big text instead of being spoken.')} checked={p.settings.showNotSpeak} onChange={(showNotSpeak) => updateSettings({ showNotSpeak })} />
      <div className="row">
        <button className="btn" onClick={() => { setScreen('tools'); setTool('myvoice'); }}><IconEdit size={18} /> {t('Open My voice')}</button>
      </div>
    </Section>
  );
}
