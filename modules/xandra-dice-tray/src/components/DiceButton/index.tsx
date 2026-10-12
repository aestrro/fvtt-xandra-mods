import type { MouseEvent } from 'react';
import type { DiceDefinition } from '../../types';
import DiceCountBadge from '../DiceCountBadge';

interface DiceButtonProps {
  count: number;
  die: DiceDefinition;
  onDecrement: () => void;
  onIncrement: () => void;
  removeLabel: string;
  addLabel: string;
}

const DiceButton = ({
  addLabel,
  count,
  die,
  onDecrement,
  onIncrement,
  removeLabel
}: DiceButtonProps) => {
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onDecrement();
  };

  return (
    <button
      type="button"
      className={`xdt-dice-button${count > 0 ? ' has-count' : ''}`}
      aria-label={addLabel}
      data-tooltip={`${die.label} · ${removeLabel}`}
      data-tooltip-direction="UP"
      onClick={onIncrement}
      onContextMenu={handleContextMenu}
    >
      <span className="xdt-dice-face" aria-hidden="true">
        {die.icon ? <i className={`fas ${die.icon}`} /> : '00'}
      </span>
      <span className="xdt-dice-label" aria-hidden="true">{die.label}</span>
      <DiceCountBadge count={count} />
    </button>
  );
};

export default DiceButton;
