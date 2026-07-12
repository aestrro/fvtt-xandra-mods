import { getActiveRollOff, SETTINGS } from '../settings.mjs';
import { canUserRoll } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Lightweight prompt shown to a participant when they need to roll.
 * Implemented as a singleton so repeated hooks do not stack windows.
 */
export class PlayerPromptApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;
  static #hookId = null;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-player-prompt',
    classes: ['xandra-roll-offs-player-prompt'],
    window: {
      title: 'Roll-Off',
      resizable: false,
    },
    position: {
      width: 280,
      height: 'auto',
    },
    actions: {
      submitRoll: PlayerPromptApp.submitRoll,
    },
  };

  static PARTS = {
    prompt: {
      template: 'modules/xandra-roll-offs/templates/player-prompt.hbs',
    },
  };

  /**
   * Show (or update) the prompt if the current user is eligible to roll.
   * Otherwise close any existing prompt.
   */
  static renderIfNeeded() {
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_PLAYER_PROMPT)) {
      if (this.#instance) this.#instance.close();
      return;
    }

    const activeRollOff = getActiveRollOff();
    const canRoll = activeRollOff?.active && canUserRoll(activeRollOff, game.userId);

    if (!canRoll) {
      if (this.#instance) this.#instance.close();
      return;
    }

    if (!this.#instance) {
      this.#instance = new this();
    }
    this.#instance.render({ force: true });
  }

  constructor(options = {}) {
    super(options);
    if (!this.constructor.#hookId) {
      this.constructor.#hookId = Hooks.on('xandraRollOffs.stateUpdated', () => {
        this.constructor.renderIfNeeded();
      });
    }
  }

  async close(options = {}) {
    this.constructor.#instance = null;
    return super.close(options);
  }

  async _prepareContext() {
    const activeRollOff = getActiveRollOff();
    const activeRound = activeRollOff?.roundStack?.at(-1);
    const canRoll = activeRollOff?.active && canUserRoll(activeRollOff, game.userId);

    return {
      roundLabel: activeRound?.label ?? '',
      dieType: activeRollOff?.dieType ?? '',
      canRoll,
    };
  }

  static async submitRoll(event, target) {
    const socket = game.modules.get('xandra-roll-offs').socketHandler;
    await socket.requestRoll(game.userId);
    const app = this.#instance;
    if (app?.rendered) app.render({ force: true });
  }
}
