import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';
import { t } from '../i18n';

/** Stack of open dialogs so Escape / Android Back closes only the top one. */
const stack: object[] = [];

export function useEscapeToClose(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const me = {};
    stack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === me) {
        e.stopImmediatePropagation();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}

interface Props {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  className?: string;
  /** Extra class on the backdrop (e.g. `scan-exempt` pauses switch scanning). */
  rootClassName?: string;
  /** Unsaved work: tapping outside, Escape/Back or ✕ ask before discarding it. */
  dirty?: boolean;
}

export function Modal({ title, onClose, children, wide, footer, className, rootClassName, dirty }: Props) {
  const [asking, setAsking] = useState(false);
  const requestClose = () => (dirty ? setAsking(true) : onClose());
  useEscapeToClose(requestClose);

  return createPortal(
    <div className={`modal-root ${rootClassName ?? ''}`} onPointerDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="modal-head" data-scan-group>
            <h2>{title}</h2>
            <button className="iconbtn" onClick={requestClose} aria-label={t('Close')} data-scan-item><IconClose /></button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot" data-scan-group>{footer}</div>}
      </div>
      {asking && (
        <Modal title={t('Discard changes?')} onClose={() => setAsking(false)}
          footer={<><span className="spacer" /><button className="btn" onClick={() => setAsking(false)} data-scan-item>{t('Keep editing')}</button>
            <button className="btn danger" onClick={onClose} data-scan-item>{t('Discard')}</button></>}>
          <p>{t("Your changes haven't been saved yet.")}</p>
        </Modal>
      )}
    </div>,
    document.body,
  );
}
