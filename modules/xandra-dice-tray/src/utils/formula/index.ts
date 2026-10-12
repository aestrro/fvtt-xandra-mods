import { DICE_TYPES } from '../../constants';
import type { DiceQueue, RollMode } from '../../types';

const buildFormula = (queue: DiceQueue, rollMode: RollMode): string => {
  const parts = DICE_TYPES.flatMap(({ type }) => {
    const count = queue[type];
    if (count <= 0) return [];

    if (type === 'd20' && rollMode !== 'normal') {
      const keep = rollMode === 'advantage' ? 'kh' : 'kl';
      return [`${count * 2}d20${keep}${count}`];
    }

    return [`${count}${type}`];
  });

  if (parts.length > 0) return parts.join(' + ');
  if (rollMode === 'advantage') return '2d20kh';
  if (rollMode === 'disadvantage') return '2d20kl';
  return '';
};

export default buildFormula;
