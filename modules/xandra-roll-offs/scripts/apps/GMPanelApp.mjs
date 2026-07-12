import { getActiveRollOff, getWinTallies, setWinTallies, SETTINGS } from '../settings.mjs';
import { canUserRoll } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM control panel for Xandra Roll-Offs.
 */
export class GMPanelApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;
  static #hookId = null;

  #selectedParticipants = null;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-gm-panel',
    classes: ['xandra-roll-offs-app'],
    tag: 'div',
    window: {
      title: 'Xandra Roll-Offs',
      resizable: true,
    },
    position: {
      width: 360,
      height: 'auto',
    },
    actions: {
      startRollOff: GMPanelApp.startRollOff,
      cancelRollOff: GMPanelApp.cancelRollOff,
      resetTallies: GMPanelApp.resetTallies,
      forceResolve: GMPanelApp.forceResolve,
    },
    form: {
      handler: null,
      submitOnChange: false,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/xandra-roll-offs/templates/gm-panel.hbs',
    },
  };

  /**
   * Render the GM panel as a singleton.
   */
  static render(options = {}) {
    if (!this.#instance) this.#instance = new this();
    return this.#instance.render({ force: true, ...options });
  }

  constructor(options = {}) {
    super(options);
    this.#selectedParticipants = null;
    if (!this.constructor.#hookId) {
      this.constructor.#hookId = Hooks.on('xandraRollOffs.stateUpdated', () => {
        if (this.constructor.#instance?.rendered) this.constructor.#instance.render({ force: true });
      });
    }
  }

  async close(options = {}) {
    this.constructor.#instance = null;
    return super.close(options);
  }

  async _prepareContext() {
    const activeRollOff = getActiveRollOff();
    const tallies = getWinTallies();
    const isActive = activeRollOff?.active ?? false;
    const defaultDieType = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_DIE_TYPE);
    const defaultWinsNeeded = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_WINS_NEEDED);

    const dieChoices = [
      { value: '1d4', label: 'd4' },
      { value: '1d6', label: 'd6' },
      { value: '1d8', label: 'd8' },
      { value: '1d10', label: 'd10' },
      { value: '1d12', label: 'd12' },
      { value: '1d20', label: 'd20' },
      { value: '1d100', label: 'd100' },
    ].map((choice) => ({
      ...choice,
      selected: choice.value === defaultDieType ? 'selected' : '',
    }));

    let currentRoundLabel = '';
    let participantStatuses = [];
    let leaderboard = [];
    let users = [];

    if (isActive) {
      const activeRound = activeRollOff.roundStack.at(-1);
      currentRoundLabel = activeRound?.label ?? '';
      participantStatuses = (activeRound?.participants ?? []).map((userId) => ({
        id: userId,
        name: game.users.get(userId)?.name ?? userId,
        rolled: !!activeRound.rolls[userId],
        value: activeRound.rolls[userId]?.total ?? null,
      }));

      leaderboard = activeRollOff.participants
        .map((userId) => ({
          name: game.users.get(userId)?.name ?? userId,
          score: tallies[userId] || 0,
        }))
        .sort((a, b) => b.score - a.score);
    } else {
      const includeGM = game.settings.get(MODULE_ID, SETTINGS.INCLUDE_GM_BY_DEFAULT);
      users = game.users.map((u) => {
        const isChecked = this.#selectedParticipants !== null
          ? this.#selectedParticipants.has(u.id)
          : includeGM || !u.isGM;
        return { id: u.id, name: u.name, isGM: u.isGM, checked: isChecked };
      });
    }

    return {
      isActive,
      currentRoundLabel,
      participantStatuses,
      leaderboard,
      dieChoices,
      users,
      defaultWinsNeeded,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const container = this.element?.querySelector('.xro-config-form');
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[name="participants"]');
    const updateSelection = () => {
      this.#selectedParticipants = new Set(
        Array.from(checkboxes)
          .filter((cb) => cb.checked)
          .map((cb) => cb.value)
      );
      console.log(`${MODULE_ID} | GM panel selection updated`, [...this.#selectedParticipants]);
    };

    for (const cb of checkboxes) {
      cb.addEventListener('change', updateSelection);
    }
  }

  static async startRollOff(event, target) {
    event.preventDefault();
    console.log(`${MODULE_ID} | startRollOff clicked`);
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.OnlyGmStarts'));
      return;
    }
    const instance = GMPanelApp.#instance;
    const container = instance?.element?.querySelector('.xro-config-form');
    if (!container) {
      console.warn(`${MODULE_ID} | startRollOff: config container not found`);
      return;
    }
    const dieType = container.querySelector('select[name="dieType"]')?.value;
    const winsNeeded = Number(container.querySelector('input[name="winsNeeded"]')?.value);
    const stored = instance?.#selectedParticipants;
    const participants = stored !== null && stored.size > 0
      ? [...stored]
      : Array.from(container.querySelectorAll('input[name="participants"]:checked')).map((cb) => cb.value);
    console.log(`${MODULE_ID} | startRollOff manual config`, { dieType, winsNeeded, participants, fromStorage: stored !== null });
    if (participants.length < 2) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants'));
      return;
    }
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.startRollOff({ dieType, winsNeeded, participants });
  }

  static async cancelRollOff(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.cancelRollOff();
  }

  static async resetTallies(event, target) {
    if (!game.user.isGM) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Reset Tallies' },
      content: '<p>Reset all win tallies? This cannot be undone.</p>',
    });
    if (confirmed) {
      await setWinTallies({});
      Hooks.callAll('xandraRollOffs.stateUpdated', {});
    }
  }

  static async forceResolve(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.forceResolve();
  }
}
