import { getActiveRollOff, setActiveRollOff, getWinTallies, setWinTallies, SETTINGS } from './settings.mjs';
import * as State from './state.mjs';
import * as Chat from './chat.mjs';

const MODULE_ID = 'xandra-roll-offs';
const SOCKET_NAMESPACE = 'module.xandra-roll-offs';

/**
 * Socket handler for the module. Installed once during `init`.
 * All GM-authoritative mutations are guarded by `game.user.isGM`.
 */
export class RollOffSocketHandler {
  constructor() {
    this._registerHandler();
  }

  _registerHandler() {
    game.socket.on(SOCKET_NAMESPACE, this._onSocketEvent.bind(this));
    console.log(`${MODULE_ID} | Socket handler registered`);
  }

  _onSocketEvent(data) {
    if (!data?.type) return;

    switch (data.type) {
      case 'submitRoll':
        this._onSubmitRoll(data);
        break;
      case 'requestStartRollOff':
        this._onRequestStartRollOff(data);
        break;
      case 'stateUpdated':
      case 'roundStarted':
      case 'tiebreakStarted':
      case 'rollOffEnded':
      case 'rollOffCancelled':
        this._onBroadcast(data);
        break;
      default:
        console.warn(`${MODULE_ID} | Unknown socket event type: ${data.type}`);
    }
  }

  /* ================================================================ */
  /*  Public API used by UI                                           */
  /* ================================================================ */

  /**
   * Request a roll for a participant. On the GM client, the roll is evaluated
   * directly; on players, it emits to the GM.
   * @param {string} userId
   */
  async requestRoll(userId) {
    if (game.user.isGM && userId === game.userId) {
      await this._onSubmitRoll({ type: 'submitRoll', userId });
    } else {
      this._emit('submitRoll', { userId, roundLabel: this._getActiveRoundLabel() });
    }
  }

  /**
   * Start a new roll-off. GM only; broadcasts to all clients.
   * @param {{dieType: string, totalRounds: number, participants: string[]}} config
   */
  async startRollOff(config) {
    if (game.user.isGM) {
      await this._onRequestStartRollOff({ type: 'requestStartRollOff', ...config });
    } else {
      this._emit('requestStartRollOff', config);
    }
  }

  /**
   * Cancel the active roll-off. GM only.
   */
  async cancelRollOff() {
    if (!game.user.isGM) return;
    const activeRollOff = getActiveRollOff();
    if (!activeRollOff) return;

    activeRollOff.active = false;
    await setActiveRollOff(activeRollOff);
    this._emit('rollOffCancelled', {});
    this._emit('stateUpdated', activeRollOff);
  }

  /**
   * Force-resolve the active round by dropping pending rollers and resolving.
   * GM only.
   */
  async forceResolve() {
    if (!game.user.isGM) return;
    const activeRollOff = getActiveRollOff();
    if (!activeRollOff?.active) return;

    const activeRound = State.findActiveRound(activeRollOff.roundStack);
    if (!activeRound) return;

    const pending = State.getPendingRollers(activeRollOff);
    if (pending.length === 0) return;

    activeRound.participants = activeRound.participants.filter((id) => !pending.includes(id));
    await setActiveRollOff(activeRollOff);
    this._emit('stateUpdated', activeRollOff);

    if (State.isRoundComplete(activeRollOff)) {
      await this._resolveRound(activeRollOff);
    }
  }

  /* ================================================================ */
  /*  GM-only event handlers                                          */
  /* ================================================================ */

  async _onSubmitRoll(data) {
    if (!game.user.isGM) return;

    const activeRollOff = getActiveRollOff();
    if (!activeRollOff?.active) {
      console.warn(`${MODULE_ID} | submitRoll ignored: no active roll-off`);
      return;
    }

    const userId = data.userId;
    if (!State.canUserRoll(activeRollOff, userId)) {
      console.warn(`${MODULE_ID} | submitRoll ignored: user ${userId} cannot roll`);
      return;
    }

    const activeRound = State.findActiveRound(activeRollOff.roundStack);
    const dieType = activeRollOff.dieType;

    try {
      const roll = await new Roll(dieType).evaluate({ allowInteractive: false });
      State.submitRoll(activeRollOff, userId, { total: roll.total, rollId: roll.id });
      await setActiveRollOff(activeRollOff);

      if (game.settings.get(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD)) {
        await this._postAuditRoll(userId, roll, activeRound.label);
      }
      this._emit('stateUpdated', activeRollOff);

      if (State.isRoundComplete(activeRollOff)) {
        await this._resolveRound(activeRollOff);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Roll evaluation failed for user ${userId}`, err);
      ui.notifications?.error?.(`Roll-off roll failed: ${err.message}`);
    }
  }

  async _onRequestStartRollOff(data) {
    if (!game.user.isGM) return;

    if (!data.dieType || !data.totalRounds || !Array.isArray(data.participants) || data.participants.length < 2) {
      console.warn(`${MODULE_ID} | requestStartRollOff rejected: invalid configuration`, data);
      ui.notifications?.warn?.('Roll-off requires a die type, at least one round, and at least two participants.');
      return;
    }

    const activeRollOff = State.startRollOff({
      dieType: data.dieType,
      totalRounds: data.totalRounds,
      participants: data.participants,
    });

    await setActiveRollOff(activeRollOff);
    await setWinTallies(getWinTallies()); // ensure initialized
    const startedRound = State.findActiveRound(activeRollOff.roundStack);
    await Chat.postRollOffStarted(startedRound, data.totalRounds, data.participants, data.dieType);
    await Chat.postRoundStarted(startedRound, data.participants, data.dieType);
    this._emit('stateUpdated', activeRollOff);
    this._emit('roundStarted', startedRound);
  }

  _onBroadcast(data) {
    // Broadcasts reach every client; the UI reacts via local hooks.
    Hooks.callAll(`xandraRollOffs.${data.type}`, data.payload ?? data);
  }

  /* ================================================================ */
  /*  Resolution helpers                                              */
  /* ================================================================ */

  async _resolveRound(activeRollOff) {
    const result = State.onAllRolledIn(activeRollOff);
    await setActiveRollOff(activeRollOff);

    if (result.type === 'winner') {
      const tallies = getWinTallies();
      tallies[result.winnerId] = (tallies[result.winnerId] || 0) + 1;
      await setWinTallies(tallies);
      await Chat.postRoundSummary(result.round, game.users.get(result.winnerId), false, []);
      this._emit('stateUpdated', activeRollOff);

      if (activeRollOff.active) {
        const newRound = State.findActiveRound(activeRollOff.roundStack);
        await Chat.postRoundStarted(newRound, newRound.participants, activeRollOff.dieType);
        this._emit('roundStarted', newRound);
      } else {
        await Chat.postRollOffSummary(activeRollOff.history, getWinTallies());
        this._emit('rollOffEnded', {
          winnerByRound: activeRollOff.history,
          finalTallies: getWinTallies(),
        });
      }
    } else if (result.type === 'tiebreak') {
      const topRound = State.findActiveRound(activeRollOff.roundStack);
      const tiedUserIds = topRound.participants;
      await Chat.postRoundSummary(topRound.parent, null, true, tiedUserIds);
      await Chat.postRoundStarted(topRound, tiedUserIds, activeRollOff.dieType);
      this._emit('tiebreakStarted', topRound);
      this._emit('stateUpdated', activeRollOff);
    }
  }

  /* ================================================================ */
  /*  Chat helpers                                                  */
  /* ================================================================ */

  async _postAuditRoll(userId, roll, roundLabel) {
    const user = game.users.get(userId);
    const speaker = user?.character
      ? ChatMessage.getSpeaker({ actor: user.character })
      : { alias: user?.name ?? userId };
    const flavor = `${user?.name ?? userId} rolls for ${roundLabel}`;

    await roll.toMessage({
      speaker,
      flavor,
    }, { create: true });
  }

  /* ================================================================ */
  /*  Utilities                                                       */
  /* ================================================================ */

  _getActiveRoundLabel() {
    const activeRollOff = getActiveRollOff();
    return State.findActiveRound(activeRollOff?.roundStack)?.label ?? '';
  }

  _emit(type, payload) {
    game.socket.emit(SOCKET_NAMESPACE, { type, ...payload });
    Hooks.callAll(`xandraRollOffs.${type}`, payload);
  }
}

export function initSocketHandler() {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.socketHandler = new RollOffSocketHandler();
}
