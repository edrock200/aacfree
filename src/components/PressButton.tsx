import type { ButtonHTMLAttributes, Ref } from 'react';
import { usePress } from '../lib/usePress';
import { useSettings } from '../store';
import type { Settings } from '../types';

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerMove' | 'onPointerCancel' | 'onPointerLeave' | 'onContextMenu'>;

export interface PressButtonProps extends Native {
  /** What the button does. Runs after the person's hold / debounce / press-on-touch settings are met. */
  onPress: () => void;
  onLongPress?: () => void;
  /** Override the profile's touch settings (e.g. editing controls never need a hold). */
  touch?: Partial<Pick<Settings, 'holdMs' | 'debounceMs' | 'pressOnDown'>>;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A button for anything the AAC user activates. It applies the touch
 * accommodations (hold to select, ignore repeated taps, select on touch), and
 * works with switch scanning, dwell and the keyboard (clicks with detail 0).
 * Use it instead of a plain `onClick` button on every user-facing screen.
 */
export function PressButton({ onPress, onLongPress, touch, disabled, className, type = 'button', children, ...rest }: PressButtonProps) {
  const s = useSettings();
  const press = usePress({
    onActivate: onPress,
    onLongPress,
    holdMs: touch?.holdMs ?? s.holdMs,
    debounceMs: touch?.debounceMs ?? s.debounceMs,
    pressOnDown: touch?.pressOnDown ?? s.pressOnDown,
    disabled,
  });
  return (
    <button {...rest} type={type} disabled={disabled} className={`pressbtn ${className ?? ''}`} {...press}>
      {children}
    </button>
  );
}
