import { useStore, useProfile } from '../../store';
import { IconSpeak } from '../../components/Icons';
import { PersonButton } from '../talkControls';
import { t } from '../../i18n';

/** A card to show or read aloud to new people, first responders, etc. */
export function AboutMeTool() {
  const p = useProfile();
  const unlocked = useStore((st) => st.unlocked);
  const contentEdit = useStore((st) => st.contentEdit);
  // The card is always shown; the text boxes only while a grown-up has tapped Edit.
  const edit = unlocked && contentEdit;
  const { speakText, updateProfile } = useStore.getState();
  return (
    <div className="aboutme">
      {edit ? (
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
        <PersonButton s={p.settings} className="btn primary big" onPress={() => speakText(p.aboutMe.text, { stoppable: true })}><IconSpeak /> {t('Read it aloud')}</PersonButton>
      </div>
    </div>
  );
}
