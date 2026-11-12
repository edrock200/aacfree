import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

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
}

export function Modal({ title, onClose, children, wide, footer, className, rootClassName }: Props) {
  useEscapeToClose(onClose);

  return createPortal(
    <div className={`modal-root ${rootClassName ?? ''}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="modal-head" data-scan-group>
            <h2>{title}</h2>
            <button className="iconbtn" onClick={onClose} aria-label="Close" data-scan-item><IconClose /></button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot" data-scan-group>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
