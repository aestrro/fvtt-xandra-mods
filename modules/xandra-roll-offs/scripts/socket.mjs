import { getActiveRollOff, setActiveRollOff, getWinTallies, setWinTallies, getRollOffHistory, setRollOffHistory, SETTINGS } from './settings.mjs';
import * as State from './state.mjs';
import * as Chat from './chat.mjs';
import { getRoundContext, getRollKey, getSessionId, sameRound, REQUEST_TIMEOUT_MS, SOCKET_NAMESPACE } from './roll-protocol.mjs';
import { escapeHTML, getParticipantIdentity, getWorldActor, snapshotParticipantIdentities } from './utils.mjs';
import { hasPendingAnimations, waitForRollAnimation } from './animation.mjs';

const MODULE_ID = 'xandra-roll-offs';
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
    participantIdentities: structuredClone(activeRollOff.participantIdentities ?? {}),
    winner: activeRollOff.history?.at(-1)?.winner ?? null,
  };
}

/**
 * Socket handler for the module. Installed once during `init`.
 * All GM-authoritative mutations are guarded by `game.user.isGM`.
 */
export class RollOffSocketHandler {
  #resolving = false;
  #starting = false;
  #rollingUsers = new Set();
  #mutationQueue = Promise.resolve();
  #pendingRequests = new Map();
  #chatClaims = new Set();

  constructor() {
    this._registerHandler();
  }

  _registerHandler() {
    game.socket.on(SOCKET_NAMESPACE, this._onSocketEvent.bind(this));
    console.log(`${MODULE_ID} | Socket handler registered`);
  }

  _onSocketEvent(data) {
    if (!data?.type) return;

    if (data.type === 'requestResult') {
      const pending = this.#pendingRequests.get(data.requestId);
      if (!pending || data.requesterId !== game.userId || data.authorityId !== pending.authorityId) return;
      this.#pendingRequests.delete(data.requestId);
      clearTimeout(pending.timeout);
      pending.resolve(data.accepted === true);
      return;
    }

    if (['submitRoll', 'requestStartRollOff', 'requestAdvance', 'requestForceResolve', 'requestClose', 'requestSetIdentity'].includes(data.type)) {
      if (!this._isAuthority() || data.authorityId !== game.userId) return;
      return this._runSocketTask(data.type, async () => {
        let accepted = false;
        try {
          accepted = await this._handleRequest(data);
        } finally {
          game.socket.emit(SOCKET_NAMESPACE, {
            type: 'requestResult', requestId: data.requestId, requesterId: data.requesterId,
            authorityId: game.userId, accepted,
          });
        }
      });
    }

    if (data.type === 'rolling' || data.type === 'animateRoll' || data.type === 'rollAnimationCancelled') {
      this._onBroadcast(data);
      return;
    }

    switch (data.type) {
      case 'stateUpdated':
      case 'roundRollsComplete':
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

    return this._request('submitRoll', { userId });
  }

  /**
   * Start a new roll-off. GM only; broadcasts to all clients.
   * @param {{dieType: string, winsNeeded: number, participants: string[]}} config
   */
  async startRollOff(config) {
    if (!game.user.isGM) return false;
    return this._request('requestStartRollOff', config);
  }

  /**
   * Cancel the active roll-off. GM only.
   */
  async cancelRollOff() {
    return this.closeRollOff();
  }

  /**
   * Close the active roll-off and clear its state. GM only.
   */
  async closeRollOff() {
    if (!game.user.isGM) return false;
    return this._request('requestClose');
  }

  async setGMIdentity(actorId) {
    if (!game.user.isGM) return false;
    return this._request('requestSetIdentity', { actorId });
  }

  async _setGMIdentity(data) {
    if (!this._isAuthority() || Object.keys(getActiveRollOff() ?? {}).length) return false;
    if (typeof data.actorId !== 'string') return false;
    const actor = getWorldActor(data.actorId);
    if (data.actorId && !actor) return false;
    const identities = game.settings.get(MODULE_ID, SETTINGS.GM_IDENTITIES) ?? {};
    identities[data.requesterId] = actor
      ? { actorId: actor.id, name: actor.name, avatar: actor.img ?? '' }
      : getParticipantIdentity(data.requesterId);
    await game.settings.set(MODULE_ID, SETTINGS.GM_IDENTITIES, identities);
    return true;
  }

  async _closeRollOff() {
    if (!this._isAuthority()) return false;
    await setActiveRollOff({});
    await setWinTallies({});
    this._emit('rollOffCancelled', {});
    this._emit('stateUpdated', {});
    return true;
  }

  /**
   * Advance to the next round or tiebreak after the GM resolves the current round.
   * GM only.
   */
  async advanceRound() {
    if (!game.user.isGM) return false;
    return this._request('requestAdvance');
  }

  async _advanceRound() {
    if (!this._isAuthority()) return false;
    if (this.#resolving) return;
    this.#resolving = true;
    try {
      const activeRollOff = getActiveRollOff();
      if (!activeRollOff?.active) return;
      if (!State.isRoundComplete(activeRollOff)) return;
      if (hasPendingAnimations(getSessionId(activeRollOff))) return false;
      await this._resolveRound(activeRollOff);
      return true;
    } finally {
      this.#resolving = false;
    }
  }

  /**
   * Force-resolve the active round by rolling for every pending participant.
   * GM only. The GM remains authoritative; pending users are not silently
   * removed from the contest.
   */
  async forceResolve() {
    if (!game.user.isGM) return false;
    return this._request('requestForceResolve');
  }

  async _forceResolve() {
    if (!this._isAuthority()) return false;
    if (this.#resolving) return;
    this.#resolving = true;
    let context;
    let pendingUsers = [];
    let animated = false;
    try {
      const activeRollOff = getActiveRollOff();
      if (!activeRollOff?.active) return;

      const activeRound = State.findActiveRound(activeRollOff.roundStack);
      if (!activeRound) return;
      context = getRoundContext(activeRollOff);

      const pending = State.getPendingRollers(activeRollOff);
      pendingUsers = pending;
      if (pending.length === 0) return;

      const evaluatedRolls = [];
      for (const userId of pending) {
        try {
          const motion = { ...context, userId, animationId: crypto.randomUUID() };
          this._emit('rolling', motion);
          const roll = await new Roll(activeRollOff.dieType).evaluate({ allowInteractive: false });
          evaluatedRolls.push({ userId, roll, motion });
        } catch (err) {
          console.error(`${MODULE_ID} | Force-resolve roll failed for user ${userId}`, err);
          ui.notifications?.error?.(`Force-resolve roll failed: ${err.message}`);
          this._emit('rollAnimationCancelled', { ...context, userIds: pending });
          return;
        }
      }

      for (const { userId, roll } of evaluatedRolls) {
        if (!State.submitRoll(activeRollOff, userId, { total: roll.total, rollId: roll.id })) return false;
      }

      if (!this._isAuthority() || !sameRound(context, getRoundContext(getActiveRollOff()))) return false;
      await setActiveRollOff(activeRollOff);
      for (const { userId, roll, motion } of evaluatedRolls) this._animateRoll(roll, userId, motion, activeRollOff);
      animated = true;
      this._emit('stateUpdated', activeRollOff);
      if (State.isRoundComplete(activeRollOff)) {
        this._emit('roundRollsComplete', { roundLabel: activeRound.label });
      }

      if (game.settings.get(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD)) {
        for (const { userId, roll } of evaluatedRolls) {
          await this._runChatEffect('Force-resolve audit card', () => this._postAuditRoll(userId, roll, activeRound.label, context));
        }
      }

      return true;
    } finally {
      if (!animated && context && pendingUsers.length) this._emit('rollAnimationCancelled', { ...context, userIds: pendingUsers });
      this.#resolving = false;
    }
  }

  /* ================================================================ */
  /*  GM-only event handlers                                          */
  /* ================================================================ */

  async _onSubmitRoll(data) {
    console.log(`${MODULE_ID} | _onSubmitRoll received`, data);
    if (!this._isAuthority()) {
      console.warn(`${MODULE_ID} | _onSubmitRoll ignored: not GM`);
      return false;
    }

    const userId = data.userId;
    if (this.#rollingUsers.has(userId)) return false;
    this.#rollingUsers.add(userId);
    let motion;
    let animated = false;

    try {
      const activeRollOff = getActiveRollOff();
      const context = getRoundContext(activeRollOff);
      if (!sameRound(data, context)) return false;
      if (!activeRollOff?.active) {
        console.warn(`${MODULE_ID} | submitRoll ignored: no active roll-off`);
        return false;
      }

      const existing = State.findActiveRound(activeRollOff.roundStack)?.rolls?.[userId];
      if (existing) return Number.isFinite(existing.total); // Committed: acknowledge, never evaluate/post again.
      if (!State.canUserRoll(activeRollOff, userId)) {
        console.warn(`${MODULE_ID} | submitRoll ignored: user ${userId} cannot roll`);
        return false;
      }

      const activeRound = State.findActiveRound(activeRollOff.roundStack);
      const dieType = activeRollOff.dieType;
      console.log(`${MODULE_ID} | _onSubmitRoll: evaluating ${dieType} for ${userId}`);
      motion = { ...context, userId, animationId: crypto.randomUUID() };
      this._emit('rolling', motion);
      const roll = await new Roll(dieType).evaluate({ allowInteractive: false });
      console.log(`${MODULE_ID} | _onSubmitRoll: roll result ${roll.total} for ${userId}`);
      if (!this._isAuthority() || !sameRound(context, getRoundContext(getActiveRollOff()))) return false;
      if (!State.submitRoll(activeRollOff, userId, { total: roll.total, rollId: roll.id })) return false;
      await setActiveRollOff(activeRollOff);
      this._animateRoll(roll, userId, motion, activeRollOff);
      animated = true;
      this._emit('stateUpdated', activeRollOff);
      if (State.isRoundComplete(activeRollOff)) {
        this._emit('roundRollsComplete', { roundLabel: activeRound.label });
      }

      if (game.settings.get(MODULE_ID, SETTINGS.POST_PER_ROLL_CARD)) {
        await this._runChatEffect('Audit roll card', () => this._postAuditRoll(userId, roll, activeRound.label, context));
      }
      return true;

    } catch (err) {
      console.error(`${MODULE_ID} | Roll evaluation failed for user ${userId}`, err);
      ui.notifications?.error?.(`Roll-off roll failed: ${err.message}`);
      if (motion) this._emit('rollAnimationCancelled', { ...motion, userIds: [userId] });
      return false;
    } finally {
      if (motion && !animated) this._emit('rollAnimationCancelled', { ...motion, userIds: [userId] });
      this.#rollingUsers.delete(userId);
    }
  }

  _animateRoll(roll, userId, motion, active) {
    try {
      this._emit('animateRoll', {
        ...motion,
        rollData: roll.toJSON?.() ?? null,
        speaker: Chat.getSpeakerForUser(game.users.get(userId), active.participantIdentities),
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not start dice animation`, error);
      this._emit('rollAnimationCancelled', { ...motion, userIds: [userId] });
    }
  }

  async _onRequestStartRollOff(data) {
    if (!this._isAuthority()) return false;
    if (Object.keys(getActiveRollOff() ?? {}).length) return false;
    if (this.#starting) return;
    this.#starting = true;
    try {
      const dieType = typeof data.dieType === 'string' ? data.dieType.trim() : '';
      const winsNeeded = Number(data.winsNeeded);
      const selectedPlayers = Array.isArray(data.participants)
        ? [...new Set(data.participants.filter((id) => typeof id === 'string' && id.trim()))]
        : [];
      // Every GM slot is mandatory, regardless of client selection or the legacy setting.
      const gmIds = Array.from(game.users.values()).filter((user) => user.isGM).map((user) => user.id);
      const participants = [...new Set([...gmIds, ...selectedPlayers])];
      if (
        !dieType
        || !Array.isArray(data.participants)
        || !Number.isInteger(winsNeeded)
        || winsNeeded < 1
        || winsNeeded > 20
        || participants.length < 2
        || participants.some((id) => !game.users.get(id))
      ) {
        console.warn(`${MODULE_ID} | requestStartRollOff rejected: invalid configuration`, data);
        ui.notifications?.warn?.('Roll-off requires a die type, a wins-needed target, and at least two participants.');
        return;
      }

      const activeRollOff = State.startRollOff({
        dieType,
        winsNeeded,
        participants,
      });
      activeRollOff.sessionId = crypto.randomUUID();
      activeRollOff.startedAt = new Date().toISOString();
      activeRollOff.participantIdentities = snapshotParticipantIdentities(participants, game.settings.get(MODULE_ID, SETTINGS.GM_IDENTITIES) ?? {});

      await setActiveRollOff(activeRollOff);
      await setWinTallies({}); // per-roll-off tallies
      const startedRound = State.findActiveRound(activeRollOff.roundStack);
      this._emit('stateUpdated', activeRollOff);
      this._emit('roundStarted', startedRound);
      await this._runChatEffect('Roll-off start announcement', () => Chat.postRollOffStarted(startedRound, winsNeeded, participants, dieType, activeRollOff.participantIdentities));
      return true;
    } finally {
      this.#starting = false;
    }
  }

  _onBroadcast(data) {
    // Broadcasts reach every client; the UI reacts via local hooks.
    const { type, ...payload } = data;
    Hooks.callAll(`xandraRollOffs.${type}`, payload);
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
        this._emit('stateUpdated', activeRollOff);
        this._emit('rollOffEnded', {
          winnerByRound: activeRollOff.history,
          finalTallies: getWinTallies(),
        });
        await this._runChatEffect('Roll-off summary', () => Chat.postRollOffSummary(activeRollOff.history, getWinTallies(), game.users.get(result.winnerId), activeRollOff.participantIdentities));
        return;
      }

      this._emit('stateUpdated', activeRollOff);
      const newRound = State.findActiveRound(activeRollOff.roundStack);
      this._emit('roundStarted', newRound);
      if (game.settings.get(MODULE_ID, SETTINGS.POST_ROUND_ANNOUNCEMENTS)) {
        await this._runChatEffect('Round start announcement', () => Chat.postRoundStarted(newRound, newRound.participants, activeRollOff.dieType, activeRollOff.participantIdentities));
      }
    } else if (result.type === 'tiebreak') {
      const topRound = State.findActiveRound(activeRollOff.roundStack);
      const tiedUserIds = topRound.participants;
      this._emit('tiebreakStarted', topRound);
      this._emit('stateUpdated', activeRollOff);
      if (game.settings.get(MODULE_ID, SETTINGS.POST_TIEBREAK_ANNOUNCEMENTS)) {
        await this._runChatEffect('Tiebreak start announcement', () => Chat.postRoundStarted(topRound, tiedUserIds, activeRollOff.dieType, activeRollOff.participantIdentities));
      }
    }
  }

  /* ================================================================ */
  /*  Chat helpers                                                  */
  /* ================================================================ */

  async _postAuditRoll(userId, roll, roundLabel, context) {
    if (!this._isAuthority()) return;
    const active = getActiveRollOff();
    if (!sameRound(context, getRoundContext(active))) return;
    const rollKey = getRollKey(context, userId);
    if (!rollKey || !State.findActiveRound(active.roundStack)?.rolls?.[userId]) return;
    active.chatRollClaims ??= {};
    if (this.#chatClaims.has(rollKey) || active.chatRollClaims[rollKey] || game.messages?.some?.((message) => message.flags?.[MODULE_ID]?.rollKey === rollKey)) return;
    // Reserve before create: ambiguous chat failures must not cause duplicate retries.
    this.#chatClaims.add(rollKey);
    active.chatRollClaims[rollKey] = true;
    await setActiveRollOff(active);
    if (!this._isAuthority()) return;
    const user = game.users.get(userId);
    const identity = getParticipantIdentity(userId, active.participantIdentities);
    const speaker = Chat.getSpeakerForUser(user, active.participantIdentities);
    const flavor = `${escapeHTML(identity.name)} rolls for ${escapeHTML(roundLabel)}`;

    // Reserve inside the mutation queue, but never hold that queue during dice animations.
    void waitForRollAnimation(rollKey).then(async () => {
      const current = getActiveRollOff();
      if (!this._isAuthority() || !Object.keys(current ?? {}).length || getSessionId(current) !== context.sessionId) return;
      await roll.toMessage({
        speaker,
        flavor,
        flags: {
          [MODULE_ID]: { auditRoll: true, rollKey, ...context, participantId: userId },
          'dice-so-nice': { skip: true }, // The synchronized roll has already been animated.
        },
      }, { create: true });
    }).catch((error) => console.warn(`${MODULE_ID} | Audit roll card failed`, error));
  }

  async _runChatEffect(label, callback) {
    try {
      await callback();
    } catch (err) {
      console.warn(`${MODULE_ID} | ${label} failed`, err);
    }
  }

  _runSocketTask(label, callback) {
    return Promise.resolve()
      .then(callback)
      .catch((err) => {
        console.error(`${MODULE_ID} | Socket task ${label} failed`, err);
        ui.notifications?.error?.(`Roll-Off ${label} failed: ${err.message}`);
      });
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
  _isAuthority() {
    return Boolean(game.user.isGM && game.users.activeGM?.id === game.userId);
  }

  async _request(type, payload = {}) {
    const authorityId = game.users.activeGM?.id;
    if (!authorityId) {
      ui.notifications?.warn?.(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NoRollAuthority'));
      return false;
    }
    const active = getActiveRollOff();
    const data = {
      ...payload, type, authorityId, requesterId: game.userId, requestId: crypto.randomUUID(),
      ...getRoundContext(active), expectedSessionId: active?.sessionId ?? null,
    };
    if (this._isAuthority()) return this._handleRequest(data);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#pendingRequests.delete(data.requestId);
        ui.notifications?.warn?.(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.RollRequestTimeout'));
        resolve(false);
      }, REQUEST_TIMEOUT_MS);
      this.#pendingRequests.set(data.requestId, { authorityId, resolve, timeout });
      game.socket.emit(SOCKET_NAMESPACE, data);
    });
  }

  _handleRequest(data) {
    const task = this.#mutationQueue.then(async () => {
      if (!this._isAuthority() || data.authorityId !== game.userId) return false;
      const requester = game.users.get(data.requesterId);
      if (!requester) return false;
      if (data.type === 'submitRoll') {
        if (!requester.isGM && data.userId !== requester.id) return false;
        return (await this._onSubmitRoll(data)) === true;
      }
      if (!requester.isGM) return false;
      if (data.type === 'requestSetIdentity') return (await this._setGMIdentity(data)) === true;
      if (data.type === 'requestStartRollOff') return (await this._onRequestStartRollOff(data)) === true;
      const active = getActiveRollOff();
      if ((active?.sessionId ?? null) !== data.expectedSessionId) return false;
      if (data.type === 'requestClose') return (await this._closeRollOff()) === true;
      if (!sameRound(data, getRoundContext(active))) return false;
      if (data.type === 'requestAdvance') return (await this._advanceRound()) === true;
      if (data.type === 'requestForceResolve') return (await this._forceResolve()) === true;
      return false;
    });
    this.#mutationQueue = task.catch(() => {});
    return task;
  }
}

export function initSocketHandler() {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.socketHandler = new RollOffSocketHandler();
}
