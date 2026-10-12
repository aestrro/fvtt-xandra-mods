import type { DiceTrayLabels, RollMode } from '../../types';
import RollModeButton from '../RollModeButton';

interface RollControlsProps {
  labels: DiceTrayLabels;
  onRoll: () => void;
  onToggleMode: (mode: Exclude<RollMode, 'normal'>) => void;
  rollMode: RollMode;
  supportsRollModes: boolean;
}

const getRollLabel = (labels: DiceTrayLabels, rollMode: RollMode): string => {
  if (rollMode === 'advantage') return labels.rollAdvantage;
  if (rollMode === 'disadvantage') return labels.rollDisadvantage;
  return labels.roll;
};

const RollControls = ({
  labels,
  onRoll,
  onToggleMode,
  rollMode,
  supportsRollModes
}: RollControlsProps) => (
  <div
    className={`xdt-action-row${supportsRollModes ? ' has-roll-modes' : ''}`}
    role="group"
    aria-label={labels.rollControls}
  >
      {supportsRollModes && (
        <RollModeButton
          activeMode={rollMode}
          label={labels.disadvantage}
          mode="disadvantage"
          shortLabel="DIS"
          onToggle={onToggleMode}
        />
      )}
      <button
        type="button"
        className={`xdt-action-button xdt-roll-button is-${rollMode}`}
        onClick={onRoll}
      >
        <i className="fas fa-dice-d20" aria-hidden="true" />
        {getRollLabel(labels, rollMode)}
      </button>
      {supportsRollModes && (
        <RollModeButton
          activeMode={rollMode}
          label={labels.advantage}
          mode="advantage"
          shortLabel="ADV"
          onToggle={onToggleMode}
        />
      )}
  </div>
);

export default RollControls;
