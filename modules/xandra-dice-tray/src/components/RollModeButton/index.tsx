import type { RollMode } from '../../types';

interface RollModeButtonProps {
  activeMode: RollMode;
  label: string;
  mode: Exclude<RollMode, 'normal'>;
  shortLabel: string;
  onToggle: (mode: Exclude<RollMode, 'normal'>) => void;
}

const RollModeButton = ({
  activeMode,
  label,
  mode,
  onToggle,
  shortLabel
}: RollModeButtonProps) => (
  <button
    type="button"
    className={`xdt-action-button xdt-mode-button xdt-${mode}${activeMode === mode ? ' is-active' : ''}`}
    aria-label={label}
    aria-pressed={activeMode === mode}
    data-tooltip={label}
    data-tooltip-direction="UP"
    onClick={() => onToggle(mode)}
  >
    {shortLabel}
  </button>
);

export default RollModeButton;
