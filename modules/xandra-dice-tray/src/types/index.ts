import type { StoreApi } from 'zustand/vanilla';

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';
export type DiceQueue = Record<DiceType, number>;

export interface DiceDefinition {
  icon: string | null;
  label: string;
  sides: number;
  type: DiceType;
}

export interface DiceTrayState {
  clearQueue: () => void;
  decrementDice: (type: DiceType) => void;
  incrementDice: (type: DiceType) => void;
  lastFormula: string | null;
  queue: DiceQueue;
  rememberFormula: (formula: string) => void;
  rollMode: RollMode;
  toggleRollMode: (mode: Exclude<RollMode, 'normal'>) => void;
}

export type DiceTrayStore = StoreApi<DiceTrayState>;
export type DiceRollHandler = (formula: string) => boolean | void | Promise<boolean | void>;

export interface DiceTrayLabels {
  addDie: (die: string) => string;
  advantage: string;
  clear: string;
  diceGroup: string;
  disadvantage: string;
  formulaControls: string;
  removeDie: (die: string) => string;
  repeatLast: string;
  roll: string;
  rollAdvantage: string;
  rollDisadvantage: string;
  rollControls: string;
  selectDice: string;
  tray: string;
}
