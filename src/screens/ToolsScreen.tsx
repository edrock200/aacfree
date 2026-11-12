import { useStore, useProfile } from '../store';
import { Symbol } from '../components/Symbol';
import { symbolFor } from '../data/defaults';
import { IconBack, IconBell, IconCheck, IconEdit } from '../components/Icons';
import { chime } from '../lib/feedback';
import { toolShown } from '../lib/talk';
import { ScheduleTool } from './tools/ScheduleTool';
import { FirstThenTool } from './tools/FirstThenTool';
import { TimerTool } from './tools/TimerTool';
import { ScaleTool } from './tools/ScaleTool';
import { BodyTool } from './tools/BodyTool';
import { ChoiceTool } from './tools/ChoiceTool';
import { AboutMeTool } from './tools/AboutMeTool';
import { DrawTool } from './tools/DrawTool';
import { MyVoiceTool } from './tools/MyVoiceTool';
import { PersonButton } from './talkControls';
import { t, ts } from '../i18n';

type ToolId = 'schedule' | 'firstthen' | 'timer' | 'feelings' | 'pain' | 'body' | 'choice' | 'aboutme' | 'draw' | 'myvoice';

export const TOOLS: { id: ToolId; name: string; icon: string; desc: string }[] = [
  { id: 'schedule', name: 'Schedule', icon: 'schedule', desc: 'What happens today' },
  { id: 'firstthen', name: 'First / Then', icon: 'first', desc: 'First this, then that' },
  { id: 'timer', name: 'Timer', icon: 'timer', desc: 'See time passing' },
  { id: 'choice', name: 'Choices', icon: 'choose', desc: 'Pick one' },
  { id: 'feelings', name: 'How big?', icon: 'feelings', desc: 'Size of a feeling' },
  { id: 'pain', name: 'Pain scale', icon: 'pain', desc: 'How much it hurts' },
  { id: 'body', name: 'Body', icon: 'body', desc: 'Where it hurts' },
  { id: 'aboutme', name: 'About me', icon: 'communication', desc: 'Show to new people' },
  { id: 'draw', name: 'Draw', icon: 'draw', desc: 'Draw or write' },
  { id: 'myvoice', name: 'My voice', icon: 'say', desc: 'Loudness, speed, or show it instead' },
];
/** The "Get attention" tile can be hidden too. */
export const ATTENTION_TOOL = { id: 'attention', name: 'Get attention' };

/** Tools that have an editing view for grown-ups (switched on with a pencil, never by a plain tap). */
const EDITABLE: ToolId[] = ['schedule', 'aboutme'];

export function ToolsScreen() {
  const tool = useStore((st) => st.tool) as ToolId | null;
  const unlocked = useStore((st) => st.unlocked);
  const contentEdit = useStore((st) => st.contentEdit);
  const { setTool, setContentEdit } = useStore.getState();
  const p = useProfile();
  const s = p.settings;
  const { speakText } = useStore.getState();

  if (tool) {
    const tl = TOOLS.find((x) => x.id === tool);
    if (!tl) return null;
    const edit = unlocked && contentEdit;
    return (
      <div className="tool-screen">
        <div className="tool-head" data-scan-group>
          <PersonButton s={s} onPress={() => setTool(null)}><IconBack /> {t('Tools')}</PersonButton>
          <h2>{t(tl.name)}</h2>
          {unlocked && EDITABLE.includes(tool) && (
            <button className={`btn small ${edit ? 'primary' : ''}`} aria-pressed={edit} onClick={() => setContentEdit(!edit)}>
              {edit ? <><IconCheck size={18} /> {t('Done editing')}</> : <><IconEdit size={18} /> {t('Edit')}</>}
            </button>
          )}
        </div>
        <div className="tool-body">
          {tool === 'schedule' && <ScheduleTool />}
          {tool === 'firstthen' && <FirstThenTool />}
          {tool === 'timer' && <TimerTool />}
          {tool === 'choice' && <ChoiceTool />}
          {tool === 'feelings' && <ScaleTool kind="feelings" />}
          {tool === 'pain' && <ScaleTool kind="pain" />}
          {tool === 'body' && <BodyTool />}
          {tool === 'aboutme' && <AboutMeTool />}
          {tool === 'draw' && <DrawTool />}
          {tool === 'myvoice' && <MyVoiceTool />}
        </div>
      </div>
    );
  }

  return (
    <div className="tools-menu" data-scan-group>
      {TOOLS.filter((x) => toolShown(p, x.id)).map((x) => (
        <PersonButton key={x.id} s={s} className="tool-tile" onPress={() => setTool(x.id)} label={t(x.name)}>
          <Symbol value={symbolFor(x.icon)} />
          <b>{t(x.name)}</b>
          <small>{t(x.desc)}</small>
        </PersonButton>
      ))}
      {toolShown(p, ATTENTION_TOOL.id) && (
        <PersonButton s={s} className="tool-tile attention" label={t('Get attention')}
          onPress={() => { chime(); setTimeout(() => speakText(ts('Excuse me! I want to say something.')), 700); }}>
          <IconBell size={48} />
          <b>{t('Get attention')}</b>
          <small>{t('Chime + “Excuse me!”')}</small>
        </PersonButton>
      )}
    </div>
  );
}
