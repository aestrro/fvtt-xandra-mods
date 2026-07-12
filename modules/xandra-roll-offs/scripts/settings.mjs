/**
 * Xandra Roll-Offs - Module Settings
 */

const MODULE_ID = 'xandra-roll-offs';

const SETTINGS = {
  ACTIVE_ROLL_OFF: 'activeRollOff',
  WIN_TALLIES: 'winTallies',
  SHOW_CHAT_BUTTON: 'showChatButton',
  SHOW_PLAYER_PROMPT: 'showPlayerPrompt',
  POST_PER_ROLL_CARD: 'postPerRollCard',
  DEFAULT_DIE_TYPE: 'defaultDieType',
  DEFAULT_WINS_NEEDED: 'defaultWinsNeeded',
  SHOW_SIDEBAR_TAB: 'showSidebarTab',
  INCLUDE_GM_BY_DEFAULT: 'includeGMByDefault',
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
    default: {}
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

  // Visible client setting: show the chat controls button
  game.settings.register(MODULE_ID, SETTINGS.SHOW_CHAT_BUTTON, {
    name: 'XANDRA_ROLL_OFFS.Settings.ShowChatButton.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.ShowChatButton.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      const btn = document.querySelector('#chat-controls .xro-open-gm-panel');
      if (btn) btn.style.display = value ? '' : 'none';
    }
  });

  // Visible client setting: auto-open the player prompt
  game.settings.register(MODULE_ID, SETTINGS.SHOW_PLAYER_PROMPT, {
    name: 'XANDRA_ROLL_OFFS.Settings.ShowPlayerPrompt.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.ShowPlayerPrompt.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  // Visible world setting: post individual roll cards
  game.settings.register(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD, {
    name: 'XANDRA_ROLL_OFFS.Settings.PostPerRollCard.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.PostPerRollCard.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Visible world setting: whether the GM participates by default
  game.settings.register(MODULE_ID, SETTINGS.INCLUDE_GM_BY_DEFAULT, {
    name: 'XANDRA_ROLL_OFFS.Settings.IncludeGMByDefault.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.IncludeGMByDefault.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Visible world setting: default die type for new roll-offs
  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_DIE_TYPE, {
    name: 'XANDRA_ROLL_OFFS.Settings.DefaultDieType.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.DefaultDieType.Hint',
    scope: 'world',
    config: true,
    type: String,
    default: '1d20',
    choices: {
      '1d4': 'd4',
      '1d6': 'd6',
      '1d8': 'd8',
      '1d10': 'd10',
      '1d12': 'd12',
      '1d20': 'd20',
      '1d100': 'd100',
    },
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WINS_NEEDED, {
    name: 'XANDRA_ROLL_OFFS.Settings.WinsNeeded.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.WinsNeeded.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 2,
    range: { min: 1, max: 20, step: 1 },
  });

  // Visible client setting: show the sidebar tab between chat and combat
  game.settings.register(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB, {
    name: 'XANDRA_ROLL_OFFS.Settings.ShowSidebarTab.Name',
    hint: 'XANDRA_ROLL_OFFS.Settings.ShowSidebarTab.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      const tab = document.querySelector('#sidebar-tabs .item[data-tab="roll-offs"]');
      if (tab) tab.style.display = value ? '' : 'none';
    }
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

export { SETTINGS };
