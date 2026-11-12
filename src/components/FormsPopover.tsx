import { formsFor } from '../lib/morphology';
import { Modal } from './Modal';
import type { WordType } from '../types';
import { Symbol } from './Symbol';
import { PressButton } from './PressButton';
import { t } from '../i18n';

interface Props {
  word: string;
  type?: WordType;
  symbol?: string;
  explicit?: string[];
  onPick: (form: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}

/** Lets the user pick another form of a word (go → went / going / goes). */
export function FormsPopover({ word, type, symbol, explicit, onPick, onRemove, onClose }: Props) {
  const forms = explicit?.length ? explicit : formsFor(word, type);
  return (
    <Modal title={<span className="forms-title">{symbol && <Symbol value={symbol} />} {word}</span>} onClose={onClose}>
      <div className="forms-grid" data-scan-group>
        <PressButton className="form-btn base" onPress={() => onPick(word)} data-scan-item>{word}</PressButton>
        {forms.map((f) => (
          <PressButton key={f} className="form-btn" onPress={() => onPick(f)} data-scan-item>{f}</PressButton>
        ))}
      </div>
      {forms.length === 0 && <p className="muted">{t('No other forms for this word.')}</p>}
      {onRemove && (
        <div className="row-end" data-scan-group>
          <PressButton className="btn danger" onPress={onRemove} data-scan-item>{t('Remove word')}</PressButton>
        </div>
      )}
    </Modal>
  );
}
