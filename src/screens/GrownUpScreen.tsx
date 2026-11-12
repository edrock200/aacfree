import { useState } from 'react';
import { useStore, useProfile } from '../store';
import { SpeechPanel, DisplayPanel, AccessPanel } from './grownup/SettingsPanels';
import { VocabPanel } from './grownup/VocabPanel';
import { DataPanel } from './grownup/DataPanel';
import { BackupPanel } from './grownup/BackupPanel';
import { ProfilesPanel, SecurityPanel } from './grownup/ProfilesPanel';
import { HelpPanel } from './grownup/HelpPanel';
import { LibraryBrowser } from '../components/LibraryBrowser';
import { Section } from './grownup/controls';
import { IconImage, IconChart, IconEdit, IconGrid, IconHelp, IconLock, IconSave, IconSettings, IconSpeak, IconUsers, IconEye, IconPerson } from '../components/Icons';
import { t } from '../i18n';

type Panel = 'boards' | 'symbols' | 'speech' | 'display' | 'access' | 'data' | 'backup' | 'profiles' | 'security' | 'help';

const PANELS: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: 'boards', label: 'Boards & words', icon: <IconGrid /> },
  { id: 'symbols', label: 'Symbols', icon: <IconImage /> },
  { id: 'speech', label: 'Voice', icon: <IconSpeak /> },
  { id: 'display', label: 'Display', icon: <IconEye /> },
  { id: 'access', label: 'Access', icon: <IconSettings /> },
  { id: 'data', label: 'Insights', icon: <IconChart /> },
  { id: 'backup', label: 'Backup', icon: <IconSave /> },
  { id: 'profiles', label: 'Profiles', icon: <IconUsers /> },
  { id: 'security', label: 'Lock', icon: <IconLock /> },
  { id: 'help', label: 'Help & tips', icon: <IconHelp /> },
];

function BackupNudge({ onGo, hidden }: { onGo: () => void; hidden: boolean }) {
  const last = Number(localStorage.getItem('caleb:lastExport') ?? 0);
  const p = useProfile();
  const age = Date.now() - p.createdAt;
  // Nudge once the profile is over 2 days old and there's no backup file in the last 30 days.
  if (hidden || age < 2 * 86400000 || Date.now() - last < 30 * 86400000) return null;
  return (
    <div className="nudge">
      <span>💾 {last ? 'Your last backup file is over a month old.' : 'You haven\'t saved a backup file yet.'} Keep a copy somewhere safe so customisations are never lost.</span>
      <button className="btn small primary" onClick={onGo}>{t('Back up now')}</button>
    </div>
  );
}

let lastPanel: Panel = 'boards';

export function GrownUpScreen() {
  const p = useProfile();
  // Remember the open panel across remounts (e.g. after changing language).
  const [panel, setPanelState] = useState<Panel>(lastPanel);
  const setPanel = (x: Panel) => { lastPanel = x; setPanelState(x); };
  const { setScreen, setEditMode } = useStore.getState();

  return (
    <div className="grownup">
      <aside className="gu-nav">
        <div className="gu-who"><IconPerson /> <b>{p.name || 'Caleb'}</b></div>
        {PANELS.map((x) => (
          <button key={x.id} className={`gu-tab ${panel === x.id ? 'on' : ''}`} onClick={() => setPanel(x.id)}>
            {x.icon}<span>{t(x.label)}</span>
          </button>
        ))}
        <div className="gu-nav-foot">
          <button className="btn" onClick={() => { setEditMode(true); setScreen('talk'); }}><IconEdit /> {t('Edit boards')}</button>
          <button className="btn primary" onClick={() => useStore.getState().lock()}><IconLock /> {t('Lock & return')}</button>
        </div>
      </aside>
      <div className="gu-main" key={panel}>
        <BackupNudge onGo={() => setPanel('backup')} hidden={panel === 'backup'} />
        {panel === 'boards' && <VocabPanel onDone={() => setScreen('talk')} />}
        {panel === 'symbols' && (
          <Section title={t('Symbol library')} intro={t('Pictures are organised into category folders. Add your own categories, such as family, school or favourite things, and your own symbols using photos, online symbols or emoji. Library symbols show up whenever you choose a picture for a button, and you can make a whole board category from a library category.')}>
            <LibraryBrowser mode="manage" />
          </Section>
        )}
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
