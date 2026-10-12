import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiceTray } from '../src/components';
import { createDiceTrayStore } from '../src/stores';
import type { DiceTrayLabels } from '../src/types';

const labels: DiceTrayLabels = {
  addDie: (die) => `Add ${die}`,
  advantage: 'Advantage',
  clear: 'clear rolls',
  diceGroup: 'Dice selection',
  disadvantage: 'Disadvantage',
  formulaControls: 'Formula controls',
  removeDie: (die) => `Remove ${die}`,
  repeatLast: 'Repeat last roll',
  roll: 'Roll',
  rollAdvantage: 'Roll w/ Advantage',
  rollDisadvantage: 'Roll w/ Disadvantage',
  rollControls: 'Roll controls',
  selectDice: 'Select dice',
  tray: 'Dice Tray'
};

describe('DiceTray', () => {
  it('shares queue actions through the supplied Zustand store', async () => {
    const user = userEvent.setup();
    const store = createDiceTrayStore();
    render(
      <DiceTray
        store={store}
        labels={labels}
        visible
        supportsRollModes
        onRoll={vi.fn()}
        onEmptyQueue={vi.fn()}
      />
    );

    expect(screen.getByRole('group', { name: 'Dice selection' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Roll controls' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Formula controls' })).toBeTruthy();
    expect(screen.getByText('Select dice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Repeat last roll' }).hasAttribute('disabled')).toBe(true);
    const d6 = screen.getByRole('button', { name: 'Add d6' });
    await user.click(d6);
    await user.click(d6);
    expect(store.getState().queue.d6).toBe(2);
    expect(screen.getByText('2d6')).toBeTruthy();

    fireEvent.contextMenu(d6);
    expect(store.getState().queue.d6).toBe(1);
  });

  it('builds the legacy advantage formula, rolls, and clears', async () => {
    const user = userEvent.setup();
    const store = createDiceTrayStore();
    const onRoll = vi.fn().mockResolvedValue(true);
    render(
      <DiceTray
        store={store}
        labels={labels}
        visible
        supportsRollModes
        onRoll={onRoll}
        onEmptyQueue={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Advantage' }));
    await user.click(screen.getByRole('button', { name: 'Add d20' }));
    await user.click(screen.getByRole('button', { name: 'Add d6' }));
    await user.click(screen.getByRole('button', { name: 'Add d6' }));
    await user.click(screen.getByRole('button', { name: 'Roll w/ Advantage' }));

    await waitFor(() => {
      expect(onRoll).toHaveBeenCalledWith('2d6 + 4d20kh2');
      expect(store.getState().rollMode).toBe('normal');
      expect(Object.values(store.getState().queue).every((count) => count === 0)).toBe(true);
    });

    expect(screen.getByText('Select dice')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add d8' }));
    await user.click(screen.getByRole('button', { name: 'Repeat last roll' }));
    expect(onRoll).toHaveBeenLastCalledWith('2d6 + 4d20kh2');
    expect(store.getState().queue.d8).toBe(1);
  });

  it('keeps the current selection and repeat disabled when a roll fails', async () => {
    const user = userEvent.setup();
    const store = createDiceTrayStore();
    const onRoll = vi.fn().mockResolvedValue(false);
    render(
      <DiceTray
        store={store}
        labels={labels}
        visible
        supportsRollModes={false}
        onRoll={onRoll}
        onEmptyQueue={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add d6' }));
    await user.click(screen.getByRole('button', { name: 'Roll' }));

    await waitFor(() => expect(onRoll).toHaveBeenCalledWith('1d6'));
    expect(store.getState().queue.d6).toBe(1);
    expect(store.getState().lastFormula).toBeNull();
    expect(screen.getByRole('button', { name: 'Repeat last roll' }).hasAttribute('disabled')).toBe(true);
  });

  it('warns instead of rolling an empty normal queue', async () => {
    const user = userEvent.setup();
    const onEmptyQueue = vi.fn();
    const onRoll = vi.fn();
    render(
      <DiceTray
        store={createDiceTrayStore()}
        labels={labels}
        visible
        supportsRollModes={false}
        onRoll={onRoll}
        onEmptyQueue={onEmptyQueue}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Roll' }));
    expect(onEmptyQueue).toHaveBeenCalledOnce();
    expect(onRoll).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Advantage' })).toBeNull();
  });
});
