import { useStore, useProfile } from '../../store';
import { IconSpeak } from '../../components/Icons';
import { t } from '../../i18n';

/** A card to show or read aloud to new people, first responders, etc. */
export function AboutMeTool() {
  const p = useProfile();
  const unlocked = useStore((st) => st.unlocked);
  const { speakText, updateProfile } = useStore.getState();
  return (
    <div className="aboutme">
      {unlocked ? (
        <>
          <label className="field"><span>{t('About me (read aloud)')}</span>
            <textarea rows={5} value={p.aboutMe.text} onChange={(e) => updateProfile((pp) => { pp.aboutMe.text = e.target.value; })} />
          </label>
          <label className="field"><span>{t('Emergency contacts (shown, not spoken)')}</span>
            <textarea rows={3} value={p.aboutMe.contacts} placeholder={t('Mom: 555-0100') + '\n' + t('Dad: 555-0101')} onChange={(e) => updateProfile((pp) => { pp.aboutMe.contacts = e.target.value; })} />
          </label>
        </>
      ) : (
        <div className="aboutme-card">
          <p>{p.aboutMe.text}</p>
          {p.aboutMe.contacts && <pre>{p.aboutMe.contacts}</pre>}
        </div>
      )}
      <div className="row-center" data-scan-group>
        <button className="btn primary big" onClick={() => speakText(p.aboutMe.text)} data-scan-item><IconSpeak /> {t('Read it aloud')}</button>
      </div>
    </div>
  );
}
