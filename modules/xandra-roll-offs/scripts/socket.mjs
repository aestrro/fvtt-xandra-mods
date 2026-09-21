import { getActiveRollOff, setActiveRollOff, getWinTallies, setWinTallies, getRollOffHistory, setRollOffHistory, SETTINGS } from './settings.mjs';
import * as State from './state.mjs';
import * as Chat from './chat.mjs';

const MODULE_ID = 'xandra-roll-offs';
const SOCKET_NAMESPACE = 'module.xandra-roll-offs';
const MAX_SESSION_HISTORY = 25;

function createSessionSnapshot(activeRollOff, endedAt) {
  return {
    id: activeRollOff.sessionId,
    startedAt: activeRollOff.startedAt,
    endedAt,
    dieType: activeRollOff.dieType,
    winsNeeded: activeRollOff.winsNeeded,
    participants: [...activeRollOff.participants],
    history: structuredClone(activeRollOff.history ?? []),
    winner: activeRollOff.history?.at(-1)?.winner ?? null,
  };
}

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
    console.log(`${MODULE_ID} | requestRoll called for ${userId}, isGM=${game.user.isGM}, me=${game.userId}`);
    if (!game.user.isGM && userId !== game.userId) {
      console.warn(`${MODULE_ID} | requestRoll blocked: players can only roll for themselves`);
      ui.notifications?.warn?.('You can only roll for yourself in a roll-off.');
      return;
    }

    if (game.user.isGM) {
      // GM evaluates the roll locally; socket.emit does not echo back to the sender.
      console.log(`${MODULE_ID} | requestRoll: GM handling roll for ${userId} locally`);
      await this._onSubmitRoll({ type: 'submitRoll', userId });
    } else {
      console.log(`${MODULE_ID} | requestRoll: emitting submitRoll for ${userId}`);
      this._emit('submitRoll', { userId, roundLabel: this._getActiveRoundLabel() });
    }
  }

  /**
   * Start a new roll-off. GM only; broadcasts to all clients.
   * @param {{dieType: string, winsNeeded: number, participants: string[]}} config
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
   * Close the active roll-off and clear its state. GM only.
   */
  async closeRollOff() {
    if (!game.user.isGM) return;
    await setActiveRollOff({});
    await setWinTallies({});
    this._emit('rollOffCancelled', {});
    this._emit('stateUpdated', {});
  }

  /**
   * Advance to the next round or tiebreak after the GM resolves the current round.
   * GM only.
   */
  async advanceRound() {
    if (!game.user.isGM) return;
    const activeRollOff = getActiveRollOff();
    if (!activeRollOff?.active) return;
    if (!State.isRoundComplete(activeRollOff)) return;
    await this._resolveRound(activeRollOff);
  }

  /**
   * Force-resolve the active round by rolling for every pending participant.
   * GM only. The GM remains authoritative; pending users are not silently
   * removed from the contest.
   */
  async forceResolve() {
    if (!game.user.isGM) return;
    const activeRollOff = getActiveRollOff();
    if (!activeRollOff?.active) return;

    const activeRound = State.findActiveRound(activeRollOff.roundStack);
    if (!activeRound) return;

    const pending = State.getPendingRollers(activeRollOff);
    if (pending.length === 0) return;

    for (const userId of pending) {
      try {
        const roll = await new Roll(activeRollOff.dieType).evaluate({ allowInteractive: false });
        State.submitRoll(activeRollOff, userId, { total: roll.total, rollId: roll.id });

        if (game.settings.get(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD)) {
          await this._postAuditRoll(userId, roll, activeRound.label);
        }
      } catch (err) {
        console.error(`${MODULE_ID} | Force-resolve roll failed for user ${userId}`, err);
        ui.notifications?.error?.(`Force-resolve roll failed: ${err.message}`);
        return;
      }
    }

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
    console.log(`${MODULE_ID} | _onSubmitRoll received`, data);
    if (!game.user.isGM) {
      console.warn(`${MODULE_ID} | _onSubmitRoll ignored: not GM`);
      return;
    }

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
      console.log(`${MODULE_ID} | _onSubmitRoll: evaluating ${dieType} for ${userId}`);
      const roll = await new Roll(dieType).evaluate({ allowInteractive: false });
      console.log(`${MODULE_ID} | _onSubmitRoll: roll result ${roll.total} for ${userId}`);
      State.submitRoll(activeRollOff, userId, { total: roll.total, rollId: roll.id });
      await setActiveRollOff(activeRollOff);

      if (game.settings.get(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD)) {
        await this._postAuditRoll(userId, roll, activeRound.label);
      }
      this._emit('stateUpdated', activeRollOff);

    } catch (err) {
      console.error(`${MODULE_ID} | Roll evaluation failed for user ${userId}`, err);
      ui.notifications?.error?.(`Roll-off roll failed: ${err.message}`);
    }
  }

  async _onRequestStartRollOff(data) {
    if (!game.user.isGM) return;

    if (!data.dieType || !data.winsNeeded || !Array.isArray(data.participants) || data.participants.length < 2) {
      console.warn(`${MODULE_ID} | requestStartRollOff rejected: invalid configuration`, data);
      ui.notifications?.warn?.('Roll-off requires a die type, a wins-needed target, and at least two participants.');
      return;
    }

    const activeRollOff = State.startRollOff({
      dieType: data.dieType,
      winsNeeded: data.winsNeeded,
      participants: data.participants,
    });
    activeRollOff.sessionId = crypto.randomUUID();
    activeRollOff.startedAt = new Date().toISOString();

    await setActiveRollOff(activeRollOff);
    await setWinTallies({}); // per-roll-off tallies
    const startedRound = State.findActiveRound(activeRollOff.roundStack);
    await Chat.postRollOffStarted(startedRound, data.winsNeeded, data.participants, data.dieType);
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
      if ((tallies[result.winnerId] || 0) >= activeRollOff.winsNeeded) {
        activeRollOff.active = false;
        const sessions = [
          ...getRollOffHistory(),
          createSessionSnapshot(activeRollOff, new Date().toISOString()),
        ].slice(-MAX_SESSION_HISTORY);
        await setRollOffHistory(sessions);
        await setActiveRollOff(activeRollOff);
        await Chat.postRollOffSummary(activeRollOff.history, getWinTallies(), game.users.get(result.winnerId));
        this._emit('stateUpdated', activeRollOff);
        this._emit('rollOffEnded', {
          winnerByRound: activeRollOff.history,
          finalTallies: getWinTallies(),
        });
        return;
      }

      this._emit('stateUpdated', activeRollOff);
      const newRound = State.findActiveRound(activeRollOff.roundStack);
      await Chat.postRoundStarted(newRound, newRound.participants, activeRollOff.dieType);
      this._emit('roundStarted', newRound);
    } else if (result.type === 'tiebreak') {
      const topRound = State.findActiveRound(activeRollOff.roundStack);
      const tiedUserIds = topRound.participants;
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
      flags: { [MODULE_ID]: { auditRoll: true } },
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
