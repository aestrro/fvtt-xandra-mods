import type { DiceTrayState } from '../types';

export const selectClearQueue = (state: DiceTrayState) => state.clearQueue;
export const selectDecrementDice = (state: DiceTrayState) => state.decrementDice;
export const selectIncrementDice = (state: DiceTrayState) => state.incrementDice;
export const selectLastFormula = (state: DiceTrayState) => state.lastFormula;
export const selectQueue = (state: DiceTrayState) => state.queue;
export const selectRememberFormula = (state: DiceTrayState) => state.rememberFormula;
export const selectRollMode = (state: DiceTrayState) => state.rollMode;
export const selectToggleRollMode = (state: DiceTrayState) => state.toggleRollMode;

const selectors = Object.freeze({
  selectClearQueue,
  selectDecrementDice,
  selectIncrementDice,
  selectLastFormula,
  selectQueue,
  selectRememberFormula,
  selectRollMode,
  selectToggleRollMode
});

export default selectors;
