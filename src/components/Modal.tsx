import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';
import { t } from '../i18n';

/** Stack of open dialogs so Escape / Android Back / Tab act on the top one only. */
interface Entry { root?: HTMLElement | null }
const stack: Entry[] = [];
/** Elements this module made inert (so it only ever undoes its own changes). */
const madeInert = new Set<HTMLElement>();

/**
 * Everything outside the top-most dialog is inert: no focus, no clicks, hidden
 * from screen readers and from scanning. Body children marked `data-modal-keep`
 * (the head-pointer status chip) stay usable.
 */
function syncInert() {
  const top = [...stack].reverse().find((e) => e.root?.isConnected)?.root ?? null;
  const topChild = top ? ([...document.body.children].find((c) => c.contains(top)) as HTMLElement | undefined) : undefined;
  for (const c of [...document.body.children] as HTMLElement[]) {
    const shouldBeInert = !!topChild && c !== topChild && !c.hasAttribute('data-modal-keep') && c.tagName !== 'SCRIPT';
    if (shouldBeInert && !c.inert) { c.inert = true; madeInert.add(c); }
    else if (!shouldBeInert && madeInert.has(c)) { c.inert = false; madeInert.delete(c); }
  }
  for (const c of madeInert) if (!c.isConnected) madeInert.delete(c);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useEscapeToClose(onClose: () => void, root?: RefObject<HTMLElement | null>) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const me: Entry = { root: root?.current };
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

/**
 * Dialog behaviour for any overlay: Escape closes it, focus moves into it and
 * is trapped there, the page behind becomes inert, and focus goes back where it
 * was on close. `root` is the dialog element (it gets focus when nothing inside has it).
 */
export function useDialog(root: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = root.current;
    const me: Entry = { root: el };
    stack.push(me);
    const before = document.activeElement as HTMLElement | null;
    syncInert();
    // Initial focus: keep an autoFocus field's focus, otherwise focus the dialog so it is announced.
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me || !el) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0);
      if (!items.length) { e.preventDefault(); el.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === el || !el.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !el.contains(active))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
      syncInert();
      // Give focus back to what opened the dialog, if it is still there and usable.
      if (before?.isConnected && !before.closest('[inert]') && typeof before.focus === 'function') {
        try { before.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    };
  }, []);
}

interface Props {
  title?: ReactNode;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
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

export function Modal({ title, ariaLabel, onClose, children, wide, footer, className, rootClassName, dirty }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [asking, setAsking] = useState(false);
  const requestClose = () => (dirty ? setAsking(true) : onClose());
  useDialog(box, requestClose);

  return createPortal(
    <div className={`modal-root ${rootClassName ?? ''}`} data-scan-scope onPointerDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={box} className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true" tabIndex={-1}
        aria-labelledby={title !== undefined ? titleId : undefined} aria-label={title === undefined ? ariaLabel : undefined}>
        {title !== undefined && (
          <div className="modal-head" data-scan-group>
            <h2 id={titleId}>{title}</h2>
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
