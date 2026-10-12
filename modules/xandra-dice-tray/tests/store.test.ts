import { describe, expect, it } from 'vitest';
import { createDiceTrayStore } from '../src/stores';

describe('dice tray store', () => {
  it('increments, decrements, and floors dice counts at zero', () => {
    const store = createDiceTrayStore();
    store.getState().incrementDice('d6');
    store.getState().incrementDice('d6');
    store.getState().decrementDice('d6');
    expect(store.getState().queue.d6).toBe(1);
    store.getState().decrementDice('d6');
    store.getState().decrementDice('d6');
    expect(store.getState().queue.d6).toBe(0);
  });

  it('clears the queue and seeds a d20 when a roll mode is enabled', () => {
    const store = createDiceTrayStore();
    store.getState().incrementDice('d8');
    store.getState().toggleRollMode('advantage');
    expect(store.getState().rollMode).toBe('advantage');
    expect(store.getState().queue.d20).toBe(1);
    expect(store.getState().queue.d8).toBe(0);

    store.getState().toggleRollMode('advantage');
    expect(store.getState().rollMode).toBe('normal');
    expect(Object.values(store.getState().queue).every((count) => count === 0)).toBe(true);
  });

  it('retains the last successful formula when the current selection is cleared', () => {
    const store = createDiceTrayStore();
    store.getState().rememberFormula('2d6 + 1');
    store.getState().incrementDice('d6');
    store.getState().clearQueue();

    expect(store.getState().lastFormula).toBe('2d6 + 1');
    expect(store.getState().queue.d6).toBe(0);
  });
});
