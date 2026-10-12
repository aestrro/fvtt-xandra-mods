import { createStore } from 'zustand/vanilla';
import type { DiceTrayState, DiceTrayStore } from '../types';
import { createInitialQueue } from '../utils';

const createDiceTrayStore = (): DiceTrayStore =>
  createStore<DiceTrayState>((set) => ({
    lastFormula: null,
    queue: createInitialQueue(),
    rollMode: 'normal',
    incrementDice: (type) =>
      set((state) => ({
        queue: {
          ...state.queue,
          [type]: state.queue[type] + 1
        }
      })),
    decrementDice: (type) =>
      set((state) => ({
        queue: {
          ...state.queue,
          [type]: Math.max(0, state.queue[type] - 1)
        }
      })),
    clearQueue: () =>
      set({
        queue: createInitialQueue(),
        rollMode: 'normal'
      }),
    rememberFormula: (formula) => set({ lastFormula: formula }),
    toggleRollMode: (mode) =>
      set((state) => {
        const rollMode = state.rollMode === mode ? 'normal' : mode;
        const queue = createInitialQueue();
        if (rollMode !== 'normal') queue.d20 = 1;
        return { queue, rollMode };
      })
  }));

export default createDiceTrayStore;
