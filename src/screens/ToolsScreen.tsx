import { useStore, useProfile } from '../store';
import { Symbol } from '../components/Symbol';
import { symbolFor } from '../data/defaults';
import { IconBack, IconBell } from '../components/Icons';
import { chime } from '../lib/feedback';
import { ScheduleTool } from './tools/ScheduleTool';
import { FirstThenTool } from './tools/FirstThenTool';
import { TimerTool } from './tools/TimerTool';
import { ScaleTool } from './tools/ScaleTool';
import { BodyTool } from './tools/BodyTool';
import { ChoiceTool } from './tools/ChoiceTool';
import { AboutMeTool } from './tools/AboutMeTool';
import { DrawTool } from './tools/DrawTool';
import { t } from '../i18n';

type ToolId = 'schedule' | 'firstthen' | 'timer' | 'feelings' | 'pain' | 'body' | 'choice' | 'aboutme' | 'draw';

const TOOLS: { id: ToolId; name: string; icon: string; desc: string }[] = [
  { id: 'schedule', name: 'Schedule', icon: 'schedule', desc: 'What happens today' },
  { id: 'firstthen', name: 'First / Then', icon: 'first', desc: 'First this, then that' },
  { id: 'timer', name: 'Timer', icon: 'timer', desc: 'See time passing' },
  { id: 'choice', name: 'Choices', icon: 'choose', desc: 'Pick one' },
  { id: 'feelings', name: 'How big?', icon: 'feelings', desc: 'Size of a feeling' },
  { id: 'pain', name: 'Pain scale', icon: 'pain', desc: 'How much it hurts' },
  { id: 'body', name: 'Body', icon: 'body', desc: 'Where it hurts' },
  { id: 'aboutme', name: 'About me', icon: 'communication', desc: 'Show to new people' },
  { id: 'draw', name: 'Draw', icon: 'draw', desc: 'Draw or write' },
];

export function ToolsScreen() {
  const tool = useStore((st) => st.tool) as ToolId | null;
  const setTool = useStore.getState().setTool;
  const p = useProfile();
  const { speakText } = useStore.getState();

  if (tool) {
    const tl = TOOLS.find((x) => x.id === tool)!;
    return (
      <div className="tool-screen">
        <div className="tool-head" data-scan-group>
          <button className="btn" onClick={() => setTool(null)} data-scan-item><IconBack /> {t('Tools')}</button>
          <h2>{t(tl.name)}</h2>
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
        </div>
      </div>
    );
  }

  return (
    <div className="tools-menu" data-scan-group>
      {TOOLS.filter((x) => x.id !== 'aboutme' || p.aboutMe.enabled).map((x) => (
        <button key={x.id} className="tool-tile" onClick={() => setTool(x.id)} data-scan-item aria-label={t(x.name)}>
          <Symbol value={symbolFor(x.icon)} />
          <b>{t(x.name)}</b>
          <small>{t(x.desc)}</small>
        </button>
      ))}
      <button className="tool-tile attention" onClick={() => { chime(); setTimeout(() => speakText(t('Excuse me! I want to say something.')), 700); }} data-scan-item aria-label={t('Get attention')}>
        <IconBell size={48} />
        <b>{t('Get attention')}</b>
        <small>{t('Chime + “Excuse me!”')}</small>
      </button>
    </div>
  );
}
