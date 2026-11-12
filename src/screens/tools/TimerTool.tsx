import { useStore } from '../../store';
import { PressButton } from '../../components/PressButton';
import { IconPlay, IconStop } from '../../components/Icons';
import { t } from '../../i18n';

const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30];

/** Visual countdown timer — the red disc shrinks as time passes. Keeps running on other screens. */
export function TimerTool() {
  const timer = useStore((st) => st.timer);
  const { setTimer } = useStore.getState();
  const running = !!timer.endAt;
  const frac = timer.total ? timer.left / timer.total : 0;
  const angle = frac * 360;
  const mm = Math.floor(timer.left / 60);
  const ss = String(timer.left % 60).padStart(2, '0');

  return (
    <div className="timer">
      <div className="timer-face" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}
        style={{ background: `conic-gradient(var(--timer) ${angle}deg, var(--timer-bg) ${angle}deg)` }}>
        <div className="timer-center">{mm}:{ss}</div>
      </div>
      <div className="row-center" data-scan-group>
        {!running ? (
          <PressButton className="btn primary big" disabled={timer.left === 0} onPress={() => setTimer({ endAt: Date.now() + timer.left * 1000 })} data-scan-item><IconPlay /> {t('Start')}</PressButton>
        ) : (
          <PressButton className="btn big" onPress={() => setTimer({ endAt: null })} data-scan-item><IconStop /> {t('Pause')}</PressButton>
        )}
        <PressButton className="btn big" onPress={() => setTimer({ endAt: null, left: timer.total })} data-scan-item>{t('Reset')}</PressButton>
        {running && <PressButton className="btn big" onPress={() => setTimer({ endAt: (timer.endAt ?? Date.now()) + 60000, total: timer.total + 60, left: timer.left + 60 })} data-scan-item>{t('+1 min')}</PressButton>}
      </div>
      <div className="row-center wrap" data-scan-group>
        {PRESETS.map((m) => (
          <PressButton key={m} className={`btn ${timer.total === m * 60 ? 'primary' : ''}`} data-scan-item
            onPress={() => setTimer({ endAt: null, total: m * 60, left: m * 60 })}>{m} min</PressButton>
        ))}
      </div>
      <p className="muted small center">{t('The timer keeps running if you go back to talking. Tap the timer chip to return here.')}</p>
    </div>
  );
}
