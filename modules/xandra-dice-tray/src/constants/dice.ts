import type { DiceDefinition } from '../types';

const DICE_TYPES = Object.freeze([
  { type: 'd4', icon: 'fa-dice-d4', label: 'd4', sides: 4 },
  { type: 'd6', icon: 'fa-dice-d6', label: 'd6', sides: 6 },
  { type: 'd8', icon: 'fa-dice-d8', label: 'd8', sides: 8 },
  { type: 'd10', icon: 'fa-dice-d10', label: 'd10', sides: 10 },
  { type: 'd12', icon: 'fa-dice-d12', label: 'd12', sides: 12 },
  { type: 'd20', icon: 'fa-dice-d20', label: 'd20', sides: 20 },
  { type: 'd100', icon: null, label: 'd%', sides: 100 }
] satisfies DiceDefinition[]);

export default DICE_TYPES;
