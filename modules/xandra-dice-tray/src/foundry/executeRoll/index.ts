import { MODULE_ID } from '../../constants';

const executeRoll = async (formula: string): Promise<boolean> => {
  try {
    const roll = new Roll(formula);
    await roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker(),
        flavor: formula
      },
      {
        rollMode: game.settings.get('core', 'rollMode')
      }
    );
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Roll error:`, error);
    ui.notifications.error(
      game.i18n.format('XANDRA_DICE_TRAY.Notifications.InvalidFormula', { formula })
    );
    return false;
  }
};

export default executeRoll;
