import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { IconTrash } from './Icons';
import { t } from '../i18n';

/**
 * Shared "are you sure?" dialog for deletions that can't simply be undone
 * (or that remove a lot at once). Pair it with an Undo toast where possible.
 */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose }: {
  title: string;
  children?: ReactNode;
  /** Defaults to "Delete". */
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <span className="spacer" />
        <button className="btn" onClick={onClose} data-scan-item>{t('Cancel')}</button>
        <button className="btn danger" onClick={() => { onConfirm(); onClose(); }} data-scan-item><IconTrash size={18} /> {confirmLabel ?? t('Delete')}</button>
      </>}>
      {children}
    </Modal>
  );
}
