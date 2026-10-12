import { act, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import mountDiceTray from '../src/foundry/mountDiceTray';
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

describe('mountDiceTray', () => {
  it('keeps expanded and collapsed roots synchronized without duplicating mounts', async () => {
    document.body.innerHTML = `
      <div id="ui-right">
        <prose-mirror id="chat-message"></prose-mirror>
        <div id="sidebar-content">
          <prose-mirror id="chat-message"></prose-mirror>
        </div>
      </div>
    `;

    const store = createDiceTrayStore();
    let enabled = true;
    let controller!: ReturnType<typeof mountDiceTray>;
    await act(async () => {
      controller = mountDiceTray({
        store,
        labels,
        isEnabled: () => enabled,
        supportsRollModes: () => true,
        onRoll: vi.fn(),
        onEmptyQueue: vi.fn()
      });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('.xdt-react-root')).toHaveLength(2);
      expect(document.querySelectorAll('.xdt-tray')).toHaveLength(2);
      const mountedTrays = [...document.querySelectorAll<HTMLElement>('.xdt-tray')];
      expect(mountedTrays.filter((tray) => !tray.hidden)).toHaveLength(1);
    });

    const collapsedTray = [...document.querySelectorAll<HTMLElement>('.xdt-tray')].find(
      (tray) => !tray.hidden
    );
    expect(collapsedTray?.closest('#sidebar-content')).toBeNull();

    const d6Buttons = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Add d6"]')];
    fireEvent.click(d6Buttons[0]);
    await waitFor(() => {
      expect(d6Buttons.every((button) => button.classList.contains('has-count'))).toBe(true);
    });

    document.querySelector('#sidebar-content')?.classList.add('expanded');
    await act(async () => controller.refresh());
    await waitFor(() => {
      const refreshedTrays = [...document.querySelectorAll<HTMLElement>('.xdt-tray')];
      expect(refreshedTrays.filter((tray) => !tray.hidden)).toHaveLength(1);
      expect(refreshedTrays.find((tray) => !tray.hidden)?.closest('#sidebar-content')).not.toBeNull();
    });

    const outsideMessage = document.querySelector('body > #ui-right > prose-mirror');
    outsideMessage?.replaceWith(document.createElement('prose-mirror'));
    const replacement = document.querySelector('body > #ui-right > prose-mirror');
    replacement?.setAttribute('id', 'chat-message');
    await act(async () => controller.refresh());
    expect(document.querySelectorAll('.xdt-react-root')).toHaveLength(2);

    enabled = false;
    await act(async () => controller.refresh());
    expect(document.querySelectorAll('.xdt-react-root')).toHaveLength(0);

    await act(async () => controller.destroy());
    expect(document.querySelectorAll('.xdt-react-root')).toHaveLength(0);
  });
});
