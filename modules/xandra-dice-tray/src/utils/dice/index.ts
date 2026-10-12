import { DICE_TYPES } from '../../constants';
import type { DiceQueue } from '../../types';

const createInitialQueue = (): DiceQueue =>
  Object.fromEntries(DICE_TYPES.map(({ type }) => [type, 0])) as DiceQueue;

export default createInitialQueue;
