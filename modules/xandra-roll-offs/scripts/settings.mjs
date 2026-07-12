/**
 * Xandra Roll-Offs - Module Settings
 */

const MODULE_ID = 'xandra-roll-offs';

const SETTINGS = {
  ACTIVE_ROLL_OFF: 'activeRollOff',
  WIN_TALLIES: 'winTallies'
};

/**
 * Register all module settings.
 */
export function registerSettings() {
  // Active roll-off state (world-scope, hidden from config UI)
  game.settings.register(MODULE_ID, SETTINGS.ACTIVE_ROLL_OFF, {
    name: 'Active Roll-Off',
    hint: 'Current roll-off session state.',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  // Persistent win tallies across roll-off sessions (world-scope, hidden from config UI)
  game.settings.register(MODULE_ID, SETTINGS.WIN_TALLIES, {
    name: 'Win Tallies',
    hint: 'Persistent count of rounds won per user.',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  console.log(`${MODULE_ID} | Settings registered`);
}

/**
 * Get the current active roll-off state.
 * @returns {object|null}
 */
export function getActiveRollOff() {
  return game.settings.get(MODULE_ID, SETTINGS.ACTIVE_ROLL_OFF);
}

/**
 * Get the current win tallies.
 * @returns {object}
 */
export function getWinTallies() {
  return game.settings.get(MODULE_ID, SETTINGS.WIN_TALLIES);
}

/**
 * Set the active roll-off state.
 * @param {object|null} value
 * @returns {Promise<void>}
 */
export async function setActiveRollOff(value) {
  await game.settings.set(MODULE_ID, SETTINGS.ACTIVE_ROLL_OFF, value);
}

/**
 * Set the win tallies.
 * @param {object} value
 * @returns {Promise<void>}
 */
export async function setWinTallies(value) {
  await game.settings.set(MODULE_ID, SETTINGS.WIN_TALLIES, value);
}
