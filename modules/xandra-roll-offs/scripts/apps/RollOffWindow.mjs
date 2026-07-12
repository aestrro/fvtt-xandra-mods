import { getActiveRollOff, getWinTallies, SETTINGS } from '../settings.mjs';
import { canUserRoll, findActiveRound } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dedicated roll-off theatre window for all participants.
 *
 * Shows current round status, a scrollable history of resolved rounds, and a live
 * leaderboard. Opens automatically when a roll-off starts and closes when it ends.
 */
export class RollOffWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;
  static #hookId = null;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-window',
    classes: ['xandra-roll-offs-window'],
    tag: 'div',
    window: {
      title: 'Roll-Off',
      resizable: true,
    },
    position: {
      width: 420,
      height: 560,
    },
    actions: {
      submitRoll: RollOffWindow.submitRoll,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/xandra-roll-offs/templates/roll-off-window.hbs',
    },
  };

  /**
   * Open (or bring to front) the roll-off window as a singleton.
   */
  static open(options = {}) {
    if (!this.#instance) {
      this.#instance = new this();
    }
    return this.#instance.render({ force: true, ...options });
  }

  /**
   * Close the roll-off window if it is open.
   */
  static close() {
    if (this.#instance?.rendered) {
      return this.#instance.close();
    }
  }

  static onStateChanged() {
    const active = getActiveRollOff()?.active ?? false;
    if (active) {
      this.open();
    } else {
      this.close();
    }
  }

  constructor(options = {}) {
    super(options);
    if (!this.constructor.#hookId) {
      this.constructor.#hookId = Hooks.on('xandraRollOffs.stateUpdated', () => {
        this.constructor.onStateChanged();
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
    const activeRound = isActive ? findActiveRound(activeRollOff.roundStack) : undefined;

    let participantStatuses = [];
    let leaderboard = [];
    let roundHistory = [];
    let canCurrentUserRoll = false;
    let winsNeeded = 0;
    let dieType = '';

    if (isActive && activeRound) {
      participantStatuses = (activeRound.participants ?? []).map((userId) => ({
        id: userId,
        name: game.users.get(userId)?.name ?? userId,
        rolled: !!activeRound.rolls[userId],
        value: activeRound.rolls[userId]?.total ?? null,
      }));
      canCurrentUserRoll = canUserRoll(activeRollOff, game.userId);
      winsNeeded = activeRollOff.winsNeeded;
      dieType = activeRollOff.dieType;

      leaderboard = (activeRollOff?.participants ?? [])
        .map((userId) => ({
          name: game.users.get(userId)?.name ?? userId,
          score: tallies[userId] || 0,
        }))
        .sort((a, b) => b.score - a.score);

      roundHistory = (activeRollOff.history ?? []).map((entry) => ({
        round: entry.round,
        label: game.i18n.format('XANDRA_ROLL_OFFS.Labels.Round', { round: entry.round }),
        winnerName: game.users.get(entry.winner)?.name ?? entry.winner,
        winnerValue: entry.finalRolls[entry.winner]?.total ?? null,
        rolls: Object.entries(entry.finalRolls).map(([userId, roll]) => ({
          name: game.users.get(userId)?.name ?? userId,
          value: roll.total,
        })),
      }));
    }

    return {
      isActive,
      roundLabel: activeRound?.label ?? '',
      winsNeeded,
      dieType,
      participantStatuses,
      leaderboard,
      roundHistory,
      canCurrentUserRoll,
      isGM: game.user.isGM,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;
    html.querySelector('[data-action="roll-off-roll"]')?.addEventListener('click', () => this._onRoll());
  }

  async _onRoll() {
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.requestRoll(game.userId);
  }

  static async submitRoll(event, target) {
    await RollOffWindow.#instance?._onRoll();
  }
}
