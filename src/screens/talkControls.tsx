import type { ReactNode } from 'react';
import { usePress } from '../lib/usePress';
import type { Settings } from '../types';

/**
 * A button the AAC user activates: honours hold / debounce / press-on-down and is scannable.
 * (Same idea as the shared PressButton; kept small so the talk screens don't depend on it.)
 */
export function PersonButton({ s, onPress, className = 'btn', children, label, pressed, disabled }: {
  s: Settings;
  onPress: () => void;
  className?: string;
  children: ReactNode;
  /** Accessible name when the content is only an icon. */
  label?: string;
  /** Toggle buttons: current state. */
  pressed?: boolean;
  disabled?: boolean;
}) {
  const press = usePress({ onActivate: onPress, holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown, disabled });
  return (
    <button className={className} data-scan-item aria-label={label} aria-pressed={pressed} disabled={disabled} {...press}>
      {children}
    </button>
  );
}
