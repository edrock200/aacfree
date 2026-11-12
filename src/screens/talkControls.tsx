import type { ReactNode } from 'react';
import { PressButton } from '../components/PressButton';
import type { Settings } from '../types';

/**
 * A scannable button the AAC user activates (hold / debounce / press-on-down apply).
 * Thin wrapper over the shared PressButton, using the given settings.
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
  return (
    <PressButton className={className} data-scan-item aria-label={label} aria-pressed={pressed} disabled={disabled}
      touch={{ holdMs: s.holdMs, debounceMs: s.debounceMs, pressOnDown: s.pressOnDown }} onPress={onPress}>
      {children}
    </PressButton>
  );
}
