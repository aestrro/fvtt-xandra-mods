import { useDiceTrayStore } from '../../hooks';
import {
  selectClearQueue,
  selectDecrementDice,
  selectIncrementDice,
  selectLastFormula,
  selectQueue,
  selectRememberFormula,
  selectRollMode,
  selectToggleRollMode
} from '../../stores';
import type { DiceRollHandler, DiceTrayLabels, DiceTrayStore } from '../../types';
import { buildFormula } from '../../utils';
import DiceRow from '../DiceRow';
import FormulaControls from '../FormulaControls';
import RollControls from '../RollControls';

interface DiceTrayProps {
  labels: DiceTrayLabels;
  onEmptyQueue: () => void;
  onRoll: DiceRollHandler;
  store: DiceTrayStore;
  supportsRollModes: boolean;
  visible: boolean;
}

const DiceTray = ({
  labels,
  onEmptyQueue,
  onRoll,
  store,
  supportsRollModes,
  visible
}: DiceTrayProps) => {
  const queue = useDiceTrayStore(store, selectQueue);
  const rollMode = useDiceTrayStore(store, selectRollMode);
  const incrementDice = useDiceTrayStore(store, selectIncrementDice);
  const decrementDice = useDiceTrayStore(store, selectDecrementDice);
  const clearQueue = useDiceTrayStore(store, selectClearQueue);
  const lastFormula = useDiceTrayStore(store, selectLastFormula);
  const rememberFormula = useDiceTrayStore(store, selectRememberFormula);
  const toggleRollMode = useDiceTrayStore(store, selectToggleRollMode);
  const formula = buildFormula(queue, rollMode);

  const submitFormula = async (submittedFormula: string, clearAfter: boolean) => {
    const succeeded = await onRoll(submittedFormula);
    if (succeeded === false) return;

    rememberFormula(submittedFormula);
    if (clearAfter) clearQueue();
  };

  const handleRoll = () => {
    if (!formula) {
      onEmptyQueue();
      return;
    }

    void submitFormula(formula, true);
  };

  const handleRepeat = () => {
    if (!lastFormula) return;
    void submitFormula(lastFormula, false);
  };

  return (
    <section
      className="xdt-tray"
      role="toolbar"
      aria-label={labels.tray}
      hidden={!visible}
    >
      <DiceRow
        queue={queue}
        addDieLabel={labels.addDie}
        groupLabel={labels.diceGroup}
        removeDieLabel={labels.removeDie}
        incrementDice={incrementDice}
        decrementDice={decrementDice}
      />
      <RollControls
        labels={labels}
        rollMode={rollMode}
        supportsRollModes={supportsRollModes}
        onRoll={handleRoll}
        onToggleMode={toggleRollMode}
      />
      <FormulaControls
        formula={formula}
        hasLastFormula={Boolean(lastFormula)}
        labels={labels}
        onClear={clearQueue}
        onRepeat={handleRepeat}
      />
    </section>
  );
};

export default DiceTray;
