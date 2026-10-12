import { MODULE_HOOKS, MODULE_ID, SETTINGS } from '../../constants';

const registerSettings = (): void => {
  game.settings.register(MODULE_ID, SETTINGS.SHOW_TRAY, {
    name: 'XANDRA_DICE_TRAY.Settings.ShowTray.Name',
    hint: 'XANDRA_DICE_TRAY.Settings.ShowTray.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll(MODULE_HOOKS.REFRESH)
  });
};

export default registerSettings;
