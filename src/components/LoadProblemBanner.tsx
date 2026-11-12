import { useState } from 'react';
import { useStore } from '../store';
import { t } from '../i18n';

/**
 * Shown while saved data could not be used and Caleb runs from memory
 * without saving (talking still works). Grown-ups can hide it for now.
 */
export function LoadProblemBanner() {
  const problem = useStore((st) => st.loadProblem);
  const [hidden, setHidden] = useState(false);
  if (!problem || hidden) return null;
  const text = problem === 'newer'
    ? t('Your boards were saved by a newer version of Caleb. Please update Caleb. Until then, changes are not saved.')
    : problem === 'unreadable'
      ? t('Your saved boards could not be opened. A copy was kept on this device. Restore a backup in Grown-ups → Backup. Until then, changes are not saved.')
      : t('Could not open saved boards. Changes will not be saved. Please restart Caleb.');
  return (
    <div className="save-error" role="alert">
      ⚠ {text}
      <button className="btn small" onClick={() => setHidden(true)}>{t('Hide')}</button>
    </div>
  );
}
