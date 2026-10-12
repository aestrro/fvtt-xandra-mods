import type { DiceTrayLabels } from '../../types';

interface FormulaControlsProps {
  formula: string;
  hasLastFormula: boolean;
  labels: DiceTrayLabels;
  onClear: () => void;
  onRepeat: () => void;
}

const FormulaControls = ({
  formula,
  hasLastFormula,
  labels,
  onClear,
  onRepeat
}: FormulaControlsProps) => {
  const displayFormula = formula || labels.selectDice;

  return (
    <div className="xdt-formula-row" role="group" aria-label={labels.formulaControls}>
      <output
        className={`xdt-formula-preview${formula ? '' : ' is-empty'}`}
        aria-live="polite"
        data-tooltip={displayFormula}
        data-tooltip-direction="UP"
      >
        <span className="xdt-formula-text">{displayFormula}</span>
      </output>
      <button
        type="button"
        className="xdt-utility-button xdt-repeat-button"
        aria-label={labels.repeatLast}
        data-tooltip={labels.repeatLast}
        data-tooltip-direction="UP"
        disabled={!hasLastFormula}
        onClick={onRepeat}
      >
        <i className="fas fa-repeat" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="xdt-utility-button xdt-clear-button"
        aria-label={labels.clear}
        data-tooltip={labels.clear}
        data-tooltip-direction="UP"
        onClick={onClear}
      >
        <i className="fas fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
};

export default FormulaControls;
