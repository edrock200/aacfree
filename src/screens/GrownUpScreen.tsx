import { useState } from 'react';
import { useStore, useProfile } from '../store';
import { SpeechPanel, DisplayPanel, AccessPanel } from './grownup/SettingsPanels';
import { VocabPanel } from './grownup/VocabPanel';
import { DataPanel } from './grownup/DataPanel';
import { BackupPanel } from './grownup/BackupPanel';
import { ProfilesPanel, SecurityPanel } from './grownup/ProfilesPanel';
import { HelpPanel } from './grownup/HelpPanel';
import { IconChart, IconEdit, IconGrid, IconHelp, IconLock, IconSave, IconSettings, IconSpeak, IconUsers, IconEye, IconPerson } from '../components/Icons';

type Panel = 'boards' | 'speech' | 'display' | 'access' | 'data' | 'backup' | 'profiles' | 'security' | 'help';

const PANELS: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: 'boards', label: 'Boards & words', icon: <IconGrid /> },
  { id: 'speech', label: 'Voice', icon: <IconSpeak /> },
  { id: 'display', label: 'Display', icon: <IconEye /> },
  { id: 'access', label: 'Access', icon: <IconSettings /> },
  { id: 'data', label: 'Insights', icon: <IconChart /> },
  { id: 'backup', label: 'Backup', icon: <IconSave /> },
  { id: 'profiles', label: 'Profiles', icon: <IconUsers /> },
  { id: 'security', label: 'Lock', icon: <IconLock /> },
  { id: 'help', label: 'Help & tips', icon: <IconHelp /> },
];

export function GrownUpScreen() {
  const p = useProfile();
  const [panel, setPanel] = useState<Panel>('boards');
  const { setScreen, setUnlocked, setEditMode } = useStore.getState();

  return (
    <div className="grownup">
      <aside className="gu-nav">
        <div className="gu-who"><IconPerson /> <b>{p.name || 'Caleb'}</b></div>
        {PANELS.map((x) => (
          <button key={x.id} className={`gu-tab ${panel === x.id ? 'on' : ''}`} onClick={() => setPanel(x.id)}>
            {x.icon}<span>{x.label}</span>
          </button>
        ))}
        <div className="gu-nav-foot">
          <button className="btn" onClick={() => { setEditMode(true); setScreen('talk'); }}><IconEdit /> Edit boards</button>
          <button className="btn primary" onClick={() => { setUnlocked(false); setScreen('talk'); }}><IconLock /> Lock & return</button>
        </div>
      </aside>
      <div className="gu-main" key={panel}>
        {panel === 'boards' && <VocabPanel onDone={() => setScreen('talk')} />}
        {panel === 'speech' && <SpeechPanel />}
        {panel === 'display' && <DisplayPanel />}
        {panel === 'access' && <AccessPanel />}
        {panel === 'data' && <DataPanel />}
        {panel === 'backup' && <BackupPanel />}
        {panel === 'profiles' && <ProfilesPanel />}
        {panel === 'security' && <SecurityPanel />}
        {panel === 'help' && <HelpPanel />}
      </div>
    </div>
  );
}
