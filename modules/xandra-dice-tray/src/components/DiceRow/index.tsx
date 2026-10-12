import { DICE_TYPES } from '../../constants';
import type { DiceQueue, DiceType } from '../../types';
import DiceButton from '../DiceButton';

interface DiceRowProps {
  addDieLabel: (die: string) => string;
  decrementDice: (type: DiceType) => void;
  groupLabel: string;
  incrementDice: (type: DiceType) => void;
  queue: DiceQueue;
  removeDieLabel: (die: string) => string;
}

const DiceRow = ({
  addDieLabel,
  decrementDice,
  groupLabel,
  incrementDice,
  queue,
  removeDieLabel
}: DiceRowProps) => (
  <div className="xdt-dice-row" role="group" aria-label={groupLabel}>
    {DICE_TYPES.map((die) => (
      <DiceButton
        key={die.type}
        die={die}
        count={queue[die.type]}
        addLabel={addDieLabel(die.label)}
        removeLabel={removeDieLabel(die.label)}
        onIncrement={() => incrementDice(die.type)}
        onDecrement={() => decrementDice(die.type)}
      />
    ))}
  </div>
);

export default DiceRow;
