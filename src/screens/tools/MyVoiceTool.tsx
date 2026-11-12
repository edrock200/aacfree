import { useStore, useProfile } from '../../store';
import { speak } from '../../lib/tts';
import { nearestVolumePreset, RATE_MAX, RATE_MIN, stepRate, VOLUME_PRESETS } from '../../lib/talk';
import { IconExpand, IconEyeOff, IconSpeak } from '../../components/Icons';
import { PersonButton } from '../talkControls';
import type { Settings } from '../../types';
import { t, ts } from '../../i18n';

/**
 * "My voice": the person's own output controls, never behind the grown-up lock.
 * Three volume presets, a speed stepper and "Show, don't speak" (messages open in Big text).
 */
export function MyVoiceTool() {
  const p = useProfile();
  const s = p.settings;
  const isPrivate = useStore((st) => st.privateMode);
  const { updateSettings, setPrivate } = useStore.getState();
  const vol = nearestVolumePreset(s.volume);

  // A short sample so the person hears the change (not logged, not in Recent).
  const sample = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    if (!next.showNotSpeak) speak(ts('This is my voice.'), next);
  };
  const set = (patch: Partial<Settings>) => { updateSettings(patch); sample(patch); };

  return (
    <div className="myvoice">
      <section className="myvoice-row">
        <h3>{t('How loud')}</h3>
        <div className="row myvoice-choices" data-scan-group role="group" aria-label={t('How loud')}>
          {VOLUME_PRESETS.map((v) => (
            <PersonButton key={v.id} s={s} className={`btn big ${vol === v.id ? 'primary' : ''}`} pressed={vol === v.id}
              onPress={() => set({ volume: v.value })}>
              <IconSpeak size={14 + v.value * 16} /> {t(v.label)}
            </PersonButton>
          ))}
        </div>
      </section>

      <section className="myvoice-row">
        <h3>{t('How fast')}</h3>
        <div className="stepper big" data-scan-group role="group" aria-label={t('How fast')}>
          <PersonButton s={s} className="btn big" disabled={s.rate <= RATE_MIN} onPress={() => set({ rate: stepRate(s.rate, -1) })}>− {t('Slower')}</PersonButton>
          <b aria-live="polite">{s.rate.toFixed(1)}×</b>
          <PersonButton s={s} className="btn big" disabled={s.rate >= RATE_MAX} onPress={() => set({ rate: stepRate(s.rate, 1) })}>{t('Faster')} +</PersonButton>
        </div>
      </section>

      <section className="myvoice-row">
        <h3>{t("Show, don't speak")}</h3>
        <p className="muted small">{t('When this is on, Caleb shows your message in big letters instead of saying it out loud.')}</p>
        <div className="row" data-scan-group>
          <PersonButton s={s} className={`btn big ${s.showNotSpeak ? 'primary' : ''}`} pressed={s.showNotSpeak}
            onPress={() => updateSettings({ showNotSpeak: !s.showNotSpeak })}>
            <IconExpand /> {s.showNotSpeak ? t('On: showing, not speaking') : t('Off: speaking out loud')}
          </PersonButton>
        </div>
      </section>

      <section className="myvoice-row">
        <h3>{t('Private for now')}</h3>
        <p className="muted small">{t("While this is on, what you say isn't kept in Recent and nothing is logged. It turns off when Caleb restarts.")}</p>
        <div className="row" data-scan-group>
          <PersonButton s={s} className={`btn big ${isPrivate ? 'primary' : ''}`} pressed={isPrivate} onPress={() => setPrivate(!isPrivate)}>
            <IconEyeOff /> {isPrivate ? t('On: private') : t('Off')}
          </PersonButton>
        </div>
      </section>
    </div>
  );
}
