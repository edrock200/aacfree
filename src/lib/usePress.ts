import { useRef, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from 'react';

/**
 * Touch accommodations for AAC buttons:
 *  - holdMs:      must hold this long to activate (filters accidental brushes)
 *  - debounceMs:  ignore repeat activations within this window (tremor / repeated taps)
 *  - pressOnDown: activate immediately on touch (fast users)
 *  - onLongPress: secondary action (e.g. word forms) when holdMs is off
 */
export interface PressOptions {
  onActivate: () => void;
  onLongPress?: () => void;
  holdMs?: number;
  debounceMs?: number;
  pressOnDown?: boolean;
  disabled?: boolean;
}

let lastActivation = 0;
let feedback: (() => void) | null = null;
/** Global hook for click sound / vibration on every activation. */
export function setPressFeedback(fn: (() => void) | null) {
  feedback = fn;
}
const LONG_PRESS_MS = 550;
const MOVE_TOLERANCE = 18;
/** Stored settings are never trusted: a huge hold or debounce time would make every button dead. */
const MAX_MS = 5000;
export const clampMs = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_MS, Math.max(0, v)) : 0);

export function usePress(o: PressOptions) {
  const opts = useRef(o);
  opts.current = o;
  const st = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; fired: boolean; active: boolean }>({
    x: 0, y: 0, fired: false, active: false,
  });

  const fire = (el?: HTMLElement | null) => {
    const { onActivate, disabled } = opts.current;
    if (disabled) return;
    const debounceMs = clampMs(opts.current.debounceMs);
    const now = Date.now();
    if (debounceMs && now - lastActivation < debounceMs) return;
    lastActivation = now;
    el?.classList.add('flash');
    setTimeout(() => el?.classList.remove('flash'), 180);
    feedback?.();
    onActivate();
  };

  const clear = (el?: HTMLElement | null) => {
    if (st.current.timer) clearTimeout(st.current.timer);
    st.current.timer = undefined;
    st.current.active = false;
    el?.classList.remove('pressing', 'holding');
  };

  return {
    onPointerDown(e: RPointerEvent<HTMLElement>) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const el = e.currentTarget;
      const { pressOnDown, onLongPress } = opts.current;
      const holdMs = clampMs(opts.current.holdMs);
      st.current = { x: e.clientX, y: e.clientY, fired: false, active: true };
      el.classList.add('pressing');
      if (holdMs > 0) {
        el.style.setProperty('--hold-ms', `${holdMs}ms`);
        el.classList.add('holding');
        st.current.timer = setTimeout(() => {
          st.current.fired = true;
          clear(el);
          fire(el);
        }, holdMs);
      } else if (pressOnDown) {
        st.current.fired = true;
        fire(el);
      } else if (onLongPress) {
        st.current.timer = setTimeout(() => {
          st.current.fired = true;
          clear(el);
          onLongPress();
        }, LONG_PRESS_MS);
      }
    },
    onPointerMove(e: RPointerEvent<HTMLElement>) {
      if (!st.current.active) return;
      if (Math.hypot(e.clientX - st.current.x, e.clientY - st.current.y) > MOVE_TOLERANCE) {
        st.current.fired = true; // treat as scroll / drag, not a press
        clear(e.currentTarget);
      }
    },
    onPointerUp(e: RPointerEvent<HTMLElement>) {
      const el = e.currentTarget;
      const wasActive = st.current.active;
      clear(el);
      if (wasActive && !st.current.fired && !clampMs(opts.current.holdMs)) fire(el);
      st.current.fired = true;
    },
    onPointerCancel(e: RPointerEvent<HTMLElement>) {
      st.current.fired = true;
      clear(e.currentTarget);
    },
    onPointerLeave(e: RPointerEvent<HTMLElement>) {
      if (st.current.active && e.pointerType === 'mouse') {
        st.current.fired = true;
        clear(e.currentTarget);
      }
    },
    onClick(e: RMouseEvent<HTMLElement>) {
      // Keyboard / switch / screen-reader activation produces click with detail 0.
      if (e.detail === 0) fire(e.currentTarget);
    },
    onContextMenu(e: RMouseEvent) {
      e.preventDefault();
    },
  };
}
