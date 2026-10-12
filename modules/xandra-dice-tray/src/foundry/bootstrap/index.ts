import { MODULE_HOOKS, MODULE_ID, SETTINGS } from '../../constants';
import { createDiceTrayStore } from '../../stores';
import type { DiceTrayLabels } from '../../types';
import executeRoll from '../executeRoll';
import mountDiceTray, { type DiceTrayMountController } from '../mountDiceTray';

let controller: DiceTrayMountController | null = null;

const getLabels = (): DiceTrayLabels => ({
  addDie: (die) => game.i18n.format('XANDRA_DICE_TRAY.Tray.AddDie', { die }),
  advantage: game.i18n.localize('XANDRA_DICE_TRAY.Tray.Advantage'),
  clear: game.i18n.localize('XANDRA_DICE_TRAY.Tray.Clear'),
  diceGroup: game.i18n.localize('XANDRA_DICE_TRAY.Tray.DiceGroup'),
  disadvantage: game.i18n.localize('XANDRA_DICE_TRAY.Tray.Disadvantage'),
  formulaControls: game.i18n.localize('XANDRA_DICE_TRAY.Tray.FormulaControls'),
  removeDie: (die) => game.i18n.format('XANDRA_DICE_TRAY.Tray.RemoveDie', { die }),
  repeatLast: game.i18n.localize('XANDRA_DICE_TRAY.Tray.RepeatLast'),
  roll: game.i18n.localize('XANDRA_DICE_TRAY.Tray.Roll'),
  rollAdvantage: game.i18n.localize('XANDRA_DICE_TRAY.Tray.RollAdvantage'),
  rollDisadvantage: game.i18n.localize('XANDRA_DICE_TRAY.Tray.RollDisadvantage'),
  rollControls: game.i18n.localize('XANDRA_DICE_TRAY.Tray.RollControls'),
  selectDice: game.i18n.localize('XANDRA_DICE_TRAY.Tray.SelectDice'),
  tray: game.i18n.localize('XANDRA_DICE_TRAY.Tray.Label')
});

const bootstrap = (): void => {
  const store = createDiceTrayStore();
  controller = mountDiceTray({
    store,
    labels: getLabels(),
    isEnabled: () => game.settings.get<boolean>(MODULE_ID, SETTINGS.SHOW_TRAY),
    supportsRollModes: () => game.system?.id === 'dnd5e',
    onRoll: executeRoll,
    onEmptyQueue: () =>
      ui.notifications.warn(game.i18n.localize('XANDRA_DICE_TRAY.Notifications.NoDice'))
  });

  const refresh = () => controller?.refresh();
  Hooks.on('renderChatLog', refresh);
  Hooks.on(MODULE_HOOKS.REFRESH, refresh);

  const destroy = () => {
    controller?.destroy();
    controller = null;
    Hooks.off?.('renderChatLog', refresh);
    Hooks.off?.(MODULE_HOOKS.REFRESH, refresh);
  };
  window.addEventListener('beforeunload', destroy, { once: true });

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ refresh, store });

  console.log(`${MODULE_ID} | Initialized v${module?.version ?? 'unknown'}`);
};

export default bootstrap;
