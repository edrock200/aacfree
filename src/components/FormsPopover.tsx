import { formsFor } from '../lib/morphology';
import { Modal } from './Modal';
import type { WordType } from '../types';
import { Symbol } from './Symbol';
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
        <button className="form-btn base" onClick={() => onPick(word)} data-scan-item>{word}</button>
        {forms.map((f) => (
          <button key={f} className="form-btn" onClick={() => onPick(f)} data-scan-item>{f}</button>
        ))}
      </div>
      {forms.length === 0 && <p className="muted">{t('No other forms for this word.')}</p>}
      {onRemove && (
        <div className="row-end" data-scan-group>
          <button className="btn danger" onClick={onRemove} data-scan-item>{t('Remove word')}</button>
        </div>
      )}
    </Modal>
  );
}
