import { getActiveRollOff, getWinTallies, setWinTallies } from '../settings.mjs';
import { canUserRoll } from '../state.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM control panel for Xandra Roll-Offs.
 */
export class GMPanelApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;
  static #hookId = null;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-gm-panel',
    classes: ['xandra-roll-offs-app'],
    tag: 'form',
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
      handler: GMPanelApp.startRollOff,
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

    const dieChoices = [
      { value: '1d20', label: 'd20', selected: 'selected' },
      { value: '1d100', label: 'd100', selected: '' },
      { value: '1d12', label: 'd12', selected: '' },
      { value: '1d10', label: 'd10', selected: '' },
      { value: '1d8', label: 'd8', selected: '' },
      { value: '1d6', label: 'd6', selected: '' },
      { value: '1d4', label: 'd4', selected: '' },
    ];

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

      leaderboard = Object.entries(tallies)
        .map(([userId, score]) => ({
          name: game.users.get(userId)?.name ?? userId,
          score,
        }))
        .sort((a, b) => b.score - a.score);
    } else {
      users = game.users.map((u) => ({ id: u.id, name: u.name, isGM: u.isGM }));
    }

    return {
      isActive,
      currentRoundLabel,
      participantStatuses,
      leaderboard,
      dieChoices,
      users,
    };
  }

  static async startRollOff(event, form, formData) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.OnlyGmStarts'));
      return;
    }
    const dieType = formData.object.dieType;
    const totalRounds = Number(formData.object.totalRounds);
    const participants = formData.object.participants ?? [];
    if (participants.length < 2) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants'));
      return;
    }
    const socket = game.modules.get('xandra-roll-offs').socketHandler;
    await socket.startRollOff({ dieType, totalRounds, participants });
  }

  static async cancelRollOff(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get('xandra-roll-offs').socketHandler;
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
    const socket = game.modules.get('xandra-roll-offs').socketHandler;
    await socket.forceResolve();
  }
}
