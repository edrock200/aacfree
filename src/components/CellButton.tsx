import { memo, type CSSProperties } from 'react';
import type { AACButton, Settings } from '../types';
import { buttonColor, textOn } from '../lib/colors';
import { applyCase } from '../lib/sentence';
import { usePress } from '../lib/usePress';
import { Symbol } from './Symbol';
import { IconEyeOff, IconPlus } from './Icons';

interface Props {
  button: AACButton | null;
  settings: Settings;
  editMode?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  row?: number;
  /** Either a plain callback… */
  onActivate?: () => void;
  onLongPress?: () => void;
  /** …or stable index-based callbacks (lets memo skip re-rendering untouched cells). */
  index?: number;
  onCell?: (index: number, button: AACButton | null) => void;
  onLong?: (button: AACButton) => void;
  compact?: boolean;
}

export const CellButton = memo(function CellButton({
  button, settings: s, editMode, highlighted, selected, row, onActivate, onLongPress, index, onCell, onLong, compact,
}: Props) {
  const dark = s.theme !== 'light';
  const activate = onActivate ?? (() => onCell?.(index ?? 0, button));
  const long = onLongPress ?? (onLong && button && !button.link && !button.action ? () => onLong(button) : undefined);
  const press = usePress({
    onActivate: activate,
    onLongPress: editMode ? undefined : long,
    holdMs: editMode ? 0 : s.holdMs,
    debounceMs: editMode ? 0 : s.debounceMs,
    pressOnDown: editMode ? false : s.pressOnDown,
  });

  if (!button) {
    if (!editMode) return <div className="cell cell-empty" aria-hidden />;
    return (
      <button className={`cell cell-add ${selected ? 'selected' : ''}`} {...press} aria-label="Add a button">
        <IconPlus size={28} />
      </button>
    );
  }

  const masked = button.hidden && !s.babble;
  if (masked && !editMode) return <div className="cell cell-empty" aria-hidden />;

  const bg = buttonColor(button.type, dark, button.color);
  const style: CSSProperties = {};
  if (s.colorMode === 'fill') {
    style.background = bg;
    style.color = button.color ? textOn(bg) : undefined;
  } else if (s.colorMode === 'border') {
    style.borderColor = buttonColor(button.type, false, button.color);
  }
  const label = applyCase(button.label, s.textCase);
  const isFolder = !!button.link;

  return (
    <button
      className={[
        'cell',
        isFolder ? 'cell-folder' : '',
        `cm-${s.colorMode}`,
        masked ? 'cell-masked' : '',
        highlighted ? 'cell-highlight' : '',
        selected ? 'selected' : '',
        compact ? 'compact' : '',
        s.labelTop ? 'label-top' : '',
      ].join(' ')}
      style={style}
      data-scan-item
      data-row={row}
      aria-label={button.label + (isFolder ? ' folder' : '')}
      {...press}
    >
      {button.symbol && <Symbol value={button.symbol} />}
      {(s.showLabels || !button.symbol) && <span className="cell-label">{label}</span>}
      {masked && <span className="cell-badge" title="Hidden from the user"><IconEyeOff size={16} /></span>}
      {button.audio && editMode && <span className="cell-badge left" title="Recorded voice">🎙</span>}
    </button>
  );
});
