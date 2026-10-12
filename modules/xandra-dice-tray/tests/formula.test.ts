import { describe, expect, it } from 'vitest';
import { createInitialQueue, buildFormula } from '../src/utils';

describe('buildFormula', () => {
  it('builds queued dice in the configured order', () => {
    const queue = createInitialQueue();
    queue.d6 = 2;
    queue.d20 = 1;
    expect(buildFormula(queue, 'normal')).toBe('2d6 + 1d20');
  });

  it('applies advantage and disadvantage only to d20s', () => {
    const queue = createInitialQueue();
    queue.d6 = 2;
    queue.d20 = 2;
    expect(buildFormula(queue, 'advantage')).toBe('2d6 + 4d20kh2');
    expect(buildFormula(queue, 'disadvantage')).toBe('2d6 + 4d20kl2');
  });

  it('uses the legacy empty-queue mode defaults', () => {
    const queue = createInitialQueue();
    expect(buildFormula(queue, 'advantage')).toBe('2d20kh');
    expect(buildFormula(queue, 'disadvantage')).toBe('2d20kl');
    expect(buildFormula(queue, 'normal')).toBe('');
  });
});
