import { useEffect, useRef } from 'react';
import type { Settings } from '../types';
import { speak } from './tts';

/**
 * Generic DOM-based switch scanning. Anything marked `data-scan-item` inside
 * a `data-scan-group` is scannable. Grids (`data-scan-grid`) are split into rows
 * by each item's `data-row`.
 *
 * Inputs: Space / Enter / any key from a Bluetooth switch, or tapping the screen.
 *  - auto:  highlight advances on a timer; any switch press selects.
 *  - step:  Space (or tap) moves, Enter (or long tap) selects.
 */
export function useScanner(s: Settings, enabled: boolean, rescanKey: unknown) {
  const state = useRef({ level: 'group' as 'group' | 'item', gi: -1, ii: -1, cycles: 0 });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const settingsRef = useRef(s);
  settingsRef.current = s;

  useEffect(() => {
    document.body.classList.toggle('scanning', enabled);
    if (!enabled) return;

    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null && !(el as HTMLElement).closest('[inert]');

    const groups = (): HTMLElement[][] => {
      const out: HTMLElement[][] = [];
      // Modal dialogs take over scanning.
      const modal = document.querySelector('.modal-root [data-scan-group]') ? document.querySelector('.modal-root')! : document;
      modal.querySelectorAll<HTMLElement>('[data-scan-group]').forEach((g) => {
        if (!visible(g)) return;
        const items = [...g.querySelectorAll<HTMLElement>('[data-scan-item]')].filter((i) => visible(i) && !(i as HTMLButtonElement).disabled);
        if (!items.length) return;
        if (g.hasAttribute('data-scan-grid')) {
          const rows = new Map<string, HTMLElement[]>();
          items.forEach((i) => {
            const r = i.dataset.row ?? '0';
            rows.set(r, [...(rows.get(r) ?? []), i]);
          });
          rows.forEach((r) => out.push(r));
        } else out.push(items);
      });
      if (settingsRef.current.scanPattern === 'linear') return [out.flat()];
      return out;
    };

    const clearHl = () => document.querySelectorAll('.scan-hl').forEach((e) => e.classList.remove('scan-hl'));

    const highlight = () => {
      clearHl();
      const gs = groups();
      const st = state.current;
      if (!gs.length) return;
      const linear = gs.length === 1;
      if (linear) st.level = 'item';
      if (st.level === 'group') {
        const g = gs[st.gi % gs.length];
        g.forEach((e) => e.classList.add('scan-hl'));
        g[0]?.scrollIntoView({ block: 'nearest' });
        if (settingsRef.current.scanSpeak) {
          const label = g.map((e) => e.getAttribute('aria-label') || e.textContent).slice(0, 3).join(', ');
          speak(label, settingsRef.current);
        }
      } else {
        const g = gs[(linear ? 0 : st.gi) % gs.length];
        const el = g[st.ii % g.length];
        el?.classList.add('scan-hl');
        el?.scrollIntoView({ block: 'nearest' });
        if (settingsRef.current.scanSpeak && el) speak(el.getAttribute('aria-label') || el.textContent || '', settingsRef.current);
      }
    };

    const next = () => {
      const st = state.current;
      const gs = groups();
      if (!gs.length) return;
      if (st.level === 'group' && gs.length > 1) {
        st.gi = (st.gi + 1) % gs.length;
      } else {
        const g = gs[gs.length === 1 ? 0 : st.gi % gs.length];
        st.ii += 1;
        if (st.ii >= g.length) {
          st.ii = 0;
          st.cycles += 1;
          // After two passes through a row, go back up to row scanning.
          if (st.cycles >= 2 && gs.length > 1) {
            st.level = 'group';
            st.cycles = 0;
          }
        }
      }
      highlight();
    };

    const select = () => {
      const st = state.current;
      const gs = groups();
      if (!gs.length) return;
      if (st.level === 'group' && gs.length > 1) {
        const g = gs[st.gi % gs.length];
        if (g.length === 1) {
          activate(g[0]);
        } else {
          st.level = 'item';
          st.ii = 0;
          st.cycles = 0;
          highlight();
          restart();
        }
        return;
      }
      const g = gs[gs.length === 1 ? 0 : st.gi % gs.length];
      const el = g[Math.max(0, st.ii) % g.length];
      if (el) activate(el);
    };

    const activate = (el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.focus();
      const st = state.current;
      st.level = 'group';
      st.gi = -1;
      st.ii = -1;
      st.cycles = 0;
      setTimeout(() => { next(); restart(); }, 400);
    };

    const restart = () => {
      if (timer.current) clearInterval(timer.current);
      if (settingsRef.current.scanMode === 'auto') timer.current = setInterval(next, settingsRef.current.scanMs);
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const mode = settingsRef.current.scanMode;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        if (mode === 'auto') select();
        else if (e.key === 'Enter') select();
        else next();
        if (mode === 'step') restart();
      }
    };

    let downAt = 0;
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.scan-exempt')) return;
      e.preventDefault();
      e.stopPropagation();
      downAt = Date.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.scan-exempt')) return;
      e.preventDefault();
      e.stopPropagation();
      const long = Date.now() - downAt > 600;
      if (settingsRef.current.scanMode === 'auto' || long) select();
      else next();
    };
    const swallow = (e: Event) => {
      if ((e as MouseEvent).detail !== 0 && !(e.target as HTMLElement).closest('.scan-exempt')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('click', swallow, true);
    state.current = { level: 'group', gi: -1, ii: -1, cycles: 0 };
    next();
    restart();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('click', swallow, true);
      if (timer.current) clearInterval(timer.current);
      clearHl();
    };
  }, [enabled, s.scanMode, s.scanMs, s.scanPattern, rescanKey]);
}
