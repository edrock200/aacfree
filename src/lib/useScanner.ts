import { useEffect, useRef } from 'react';
import type { Settings } from '../types';
import { speak } from './tts';
import { ScanController, keyAction, type Highlight, type ScanConfig } from './scanner';
import { ts } from '../i18n';

/**
 * Generic DOM-based switch scanning. Anything marked `data-scan-item` inside
 * a `data-scan-group` is scannable (an item belongs to its nearest group).
 * Grids (`data-scan-grid`) are split into rows by each item's `data-row`, or by
 * where the items sit on screen when they have none.
 *
 * The top-most dialog (`.modal-root` or anything with `data-scan-scope`) takes
 * over scanning. A dialog marked `scan-exempt` (the PIN gate) pauses it, and
 * touches on `.scan-exempt` elements work normally.
 *
 * Inputs: Space / Enter / any key a grown-up assigned, or tapping the screen.
 *  - auto:  highlight advances on a timer; any switch press selects.
 *  - step:  Space (or tap) moves, Enter (or long tap) selects.
 * Timing, key repeat, acceptance and lockout live in the pure `ScanController`.
 */

const num = (v: unknown, def: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

export function scanConfig(s: Settings): Partial<ScanConfig> {
  return {
    mode: s.scanMode === 'step' ? 'step' : 'auto',
    scanMs: num(s.scanMs, 1500, 300, 10000),
    acceptMs: num(s.scanAcceptMs, 0, 0, 2000),
    lockoutMs: num(s.scanLockoutMs, 500, 0, 5000),
    firstMs: num(s.scanFirstMs, 0, 0, 5000),
    loops: Math.round(num(s.scanLoops, 0, 0, 20)),
    leaveRow: s.scanLeaveRow === true,
  };
}

/** Voice for scan cues: the person's own, or a softer, higher one so cues don't sound like their speech. */
export function cueVoice(s: Settings) {
  if (!s.scanCueVoice) return s;
  return { ...s, pitch: Math.min(2, (s.pitch || 1) + 0.4), rate: Math.min(2, (s.rate || 1) * 1.15), volume: Math.max(0.1, (s.volume || 1) * 0.7) };
}

const visible = (el: HTMLElement) => {
  if (el.closest('[inert]')) return false;
  const cv = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
  return cv ? cv.call(el) : el.getClientRects().length > 0;
};

/** The element scanning is confined to: the top-most dialog with scan groups, else the whole page. */
function scope(): ParentNode {
  const tops = [...document.querySelectorAll<HTMLElement>('.modal-root, [data-scan-scope]')]
    .filter((m) => !m.closest('[inert]') && m.querySelector('[data-scan-group]'));
  return tops[tops.length - 1] ?? document;
}

const warned = new WeakSet<Element>();

/** The page as scan groups (rows), top-most dialog only. */
export function collectGroups(linear: boolean): HTMLElement[][] {
  const out: HTMLElement[][] = [];
  const root = scope();
  root.querySelectorAll<HTMLElement>('[data-scan-group]').forEach((g) => {
    if (!visible(g)) return;
    const items = [...g.querySelectorAll<HTMLElement>('[data-scan-item]')]
      .filter((i) => i.closest('[data-scan-group]') === g && !(i as HTMLButtonElement).disabled && visible(i));
    if (g.hasAttribute('data-scan-item') && !(g as HTMLButtonElement).disabled) items.unshift(g);
    if (!items.length) return;
    if (g.hasAttribute('data-scan-grid')) {
      const rows = new Map<string, HTMLElement[]>();
      items.forEach((i) => {
        const r = i.dataset.row ?? String(Math.round(i.getBoundingClientRect().top / 8));
        rows.set(r, [...(rows.get(r) ?? []), i]);
      });
      rows.forEach((r) => out.push(r));
    } else out.push(items);
  });
  if (import.meta.env?.DEV) {
    document.querySelectorAll('[data-scan-item]').forEach((i) => {
      if (!i.closest('[data-scan-group]') && !warned.has(i)) {
        warned.add(i);
        console.warn('Scan item outside any data-scan-group (switch users cannot reach it):', i);
      }
    });
  }
  return linear ? (out.length ? [out.flat()] : []) : out;
}

export function useScanner(s: Settings, enabled: boolean, rescanKey: unknown) {
  const settingsRef = useRef(s);
  settingsRef.current = s;
  const ctlRef = useRef<ScanController | null>(null);

  // One controller for the whole session so its lockout survives page changes.
  if (!ctlRef.current) {
    const groups = () => collectGroups(settingsRef.current.scanPattern === 'linear');
    const clearHl = () => {
      document.querySelectorAll('.scan-hl, .scan-hl-leave').forEach((e) => e.classList.remove('scan-hl', 'scan-hl-leave'));
      document.querySelectorAll('.scan-leave-chip').forEach((e) => e.remove());
    };
    const say = (text: string) => {
      const st = settingsRef.current;
      if (st.scanSpeak && text.trim()) speak(text, cueVoice(st), { prompt: true });
    };
    const label = (e: HTMLElement) => e.getAttribute('aria-label') || e.textContent || '';
    ctlRef.current = new ScanController({
      shape: () => groups().map((g) => g.length),
      now: () => Date.now(),
      show: (h: Highlight | null) => {
        clearHl();
        if (!h) return;
        const gs = groups();
        const g = gs[h.gi];
        if (!g) return;
        if (h.kind === 'group') {
          g.forEach((e) => e.classList.add('scan-hl'));
          g[0]?.scrollIntoView({ block: 'nearest' });
          say(g.map(label).slice(0, 3).join(', '));
        } else if (h.kind === 'leave') {
          g.forEach((e) => e.classList.add('scan-hl-leave'));
          const last = g[g.length - 1].getBoundingClientRect();
          const chip = document.createElement('div');
          chip.className = 'scan-leave-chip';
          chip.setAttribute('aria-hidden', 'true');
          chip.textContent = `↩ ${ts('Leave row')}`;
          chip.style.left = `${Math.max(8, Math.min(innerWidth - 160, last.right - 150))}px`;
          chip.style.top = `${Math.max(8, Math.min(innerHeight - 48, last.bottom - 20))}px`;
          document.body.appendChild(chip);
          say(ts('Leave row'));
        } else {
          const el = g[h.ii];
          if (!el) return;
          el.classList.add('scan-hl');
          el.scrollIntoView({ block: 'nearest' });
          say(label(el));
        }
      },
      activate: (gi, ii) => {
        const el = groups()[gi]?.[ii];
        // detail 0 marks a keyboard/switch activation (usePress acts on it; touch clicks are swallowed).
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
      },
    }, scanConfig(s));
  }

  useEffect(() => {
    ctlRef.current?.configure(scanConfig(s));
  }, [s.scanMode, s.scanMs, s.scanAcceptMs, s.scanLockoutMs, s.scanFirstMs, s.scanLoops, s.scanLeaveRow]);

  useEffect(() => {
    document.body.classList.toggle('scanning', enabled);
    const ctl = ctlRef.current!;
    if (!enabled) return;

    // A grown-up dialog marked scan-exempt (e.g. the PIN gate) pauses scanning entirely.
    const paused = () => !!document.querySelector('.modal-root.scan-exempt');
    const keyId = (e: KeyboardEvent) => e.code || e.key;

    const onKey = (e: KeyboardEvent) => {
      if (paused() || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = settingsRef.current;
      const action = keyAction(e, st.scanMode === 'step' ? 'step' : 'auto', {
        select: typeof st.scanKeySelect === 'string' ? st.scanKeySelect : '',
        next: typeof st.scanKeyNext === 'string' ? st.scanKeyNext : '',
      });
      if (!action) return;
      const t = e.target as HTMLElement;
      // A switch can't type; treat its keys as switch presses instead of text.
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') t.blur();
      e.preventDefault();
      e.stopPropagation();
      ctl.keyDown(keyId(e), action, e.repeat);
    };
    const onKeyUp = (e: KeyboardEvent) => ctl.keyUp(keyId(e));
    const onBlur = () => ctl.releaseAll();

    const exempt = (e: Event) => !!(e.target as HTMLElement)?.closest?.('.scan-exempt') || paused();
    const onPointerDown = (e: PointerEvent) => {
      if (exempt(e)) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();
      ctl.pointerDown();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (exempt(e)) return;
      e.preventDefault();
      e.stopPropagation();
      ctl.pointerUp();
    };
    const onPointerCancel = () => ctl.pointerCancel();
    const swallow = (e: Event) => {
      if ((e as MouseEvent).detail !== 0 && !exempt(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('click', swallow, true);
    // Dialogs are portals on <body>: when one opens or closes, scanning starts again inside the new top layer.
    let lastScope = scope();
    const mo = new MutationObserver(() => {
      const now = scope();
      if (now !== lastScope) { lastScope = now; ctl.refresh(); }
    });
    mo.observe(document.body, { childList: true });
    ctl.start();
    return () => {
      mo.disconnect();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('click', swallow, true);
      ctl.stop();
    };
  }, [enabled]);

  // The page changed (board, screen, dialog): start from the top, keeping the lockout.
  useEffect(() => {
    if (enabled) ctlRef.current?.refresh();
  }, [rescanKey, s.scanPattern]);
}
