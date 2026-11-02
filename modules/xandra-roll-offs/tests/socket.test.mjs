import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startRollOff } from '../scripts/state.mjs';
import { RollOffSocketHandler } from '../scripts/socket.mjs';
import { getRoundContext } from '../scripts/roll-protocol.mjs';

const MODULE_ID = 'xandra-roll-offs';

function createHarness({ activeRollOff = {}, postPerRollCard = false, postRoundAnnouncements = false, postTiebreakAnnouncements = false, chatAvailable = false, rollTotals = [] } = {}) {
  const values = new Map([
    ['activeRollOff', structuredClone(activeRollOff)],
    ['rollOffHistory', []],
    ['winTallies', {}],
    ['postPerRollCard', postPerRollCard],
    ['postRoundAnnouncements', postRoundAnnouncements],
    ['postTiebreakAnnouncements', postTiebreakAnnouncements],
  ]);
  const socketEvents = [];
  const hookEvents = [];
  const notifications = [];
  const chatMessages = [];
  const auditMessages = [];
  let socketListener = null;
  let rollIndex = 0;

  const users = new Map([
    ['gm', { id: 'gm', name: 'GM', isGM: true }],
    ['u1', { id: 'u1', name: 'Alice', isGM: false }],
    ['u2', { id: 'u2', name: 'Bob', isGM: false }],
  ]);
  users.activeGM = users.get('gm');

  globalThis.game = {
    user: users.get('gm'),
    userId: 'gm',
    users,
    settings: {
      get: (moduleId, key) => structuredClone(values.get(key)),
      set: async (moduleId, key, value) => values.set(key, structuredClone(value)),
    },
    socket: {
      on: (namespace, listener) => {
        socketListener = listener;
      },
      emit: (namespace, payload) => socketEvents.push({ namespace, payload }),
    },
    i18n: {
      format: (key, data) => `${key}:${JSON.stringify(data)}`,
      localize: (key) => key,
    },
  };
  globalThis.Hooks = {
    callAll: (name, payload) => hookEvents.push({ name, payload }),
  };
  globalThis.ui = {
    notifications: {
      warn: (message) => notifications.push({ type: 'warn', message }),
      error: (message) => notifications.push({ type: 'error', message }),
    },
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({ alias: 'GM' }),
    create: async (message) => {
      chatMessages.push(message);
      if (!chatAvailable) throw new Error('chat unavailable');
      return message;
    },
  };
  globalThis.foundry = { applications: { handlebars: {
    renderTemplate: async (_path, data) => JSON.stringify(data),
  } } };
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
      this.total = rollTotals[rollIndex] ?? 1;
      this.id = `roll-${rollIndex + 1}`;
      rollIndex += 1;
    }

    async evaluate() {
      return this;
    }

    async toMessage(message) {
      auditMessages.push(message);
      if (!chatAvailable) throw new Error('audit unavailable');
    }
  };

  return {
    handler: new RollOffSocketHandler(),
    users,
    values,
    socketEvents,
    hookEvents,
    notifications,
    chatMessages,
    auditMessages,
    dispatch: (payload) => socketListener?.(payload),
    get rollCount() {
      return rollIndex;
    },
  };
}

describe('RollOffSocketHandler hardening', () => {
  beforeEach(() => {
    globalThis.crypto ??= { randomUUID: () => 'session-1' };
  });

  it('clears active state and tallies when cancelling', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff });

    await harness.handler.cancelRollOff();

    assert.deepEqual(harness.values.get('activeRollOff'), {});
    assert.deepEqual(harness.values.get('winTallies'), {});
    assert.equal(harness.hookEvents.at(-1).name, 'xandraRollOffs.stateUpdated');
    assert.deepEqual(harness.hookEvents.at(-1).payload, {});
    assert.equal(harness.chatMessages.length, 0);
  });

  it('posts only start and final results for a complete quiet contest', async () => {
    const harness = createHarness({ chatAvailable: true, rollTotals: [18, 4, 17, 3] });
    await harness.handler.startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(harness.chatMessages.length, 1);
    await harness.handler.requestRoll('u1');
    await harness.handler.requestRoll('u2');
    await harness.handler.advanceRound();
    assert.equal(harness.chatMessages.length, 1);
    await harness.handler.forceResolve();
    await harness.handler.advanceRound();
    assert.equal(harness.values.get('activeRollOff').active, false);
    assert.equal(harness.chatMessages.length, 2);
    assert.equal(harness.auditMessages.length, 0);
    assert.match(harness.chatMessages[1].content, /Alice/);
  });

  it('posts optional subsequent-round announcements without duplicating round one', async () => {
    const harness = createHarness({ chatAvailable: true, postRoundAnnouncements: true, rollTotals: [18, 4] });
    await harness.handler.startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(harness.chatMessages.length, 1);
    await harness.handler.forceResolve();
    await harness.handler.advanceRound();
    assert.equal(harness.chatMessages.length, 2);
    assert.match(harness.chatMessages[1].content, /Round 2 Started/);
  });

  it('makes tiebreak announcements opt-in without suppressing tiebreak UI events', async () => {
    for (const enabled of [false, true]) {
      const harness = createHarness({ chatAvailable: true, postTiebreakAnnouncements: enabled, rollTotals: [10, 10] });
      await harness.handler.startRollOff({ dieType: '1d20', winsNeeded: 1, participants: ['u1', 'u2'] });
      await harness.handler.forceResolve();
      await harness.handler.advanceRound();
      assert.ok(harness.hookEvents.some((event) => event.name === 'xandraRollOffs.tiebreakStarted'));
      assert.equal(harness.chatMessages.length, enabled ? 2 : 1);
      if (enabled) assert.match(harness.chatMessages[1].content, /Tie-Break #1 Started/);
    }
  });

  it('honors opt-in individual audit cards for both ordinary and missing-player rolls', async () => {
    const harness = createHarness({ chatAvailable: true, postPerRollCard: true, rollTotals: [18, 4] });
    await harness.handler.startRollOff({ dieType: '1d20', winsNeeded: 1, participants: ['u1', 'u2'] });
    await harness.handler.requestRoll('u1');
    await harness.handler.forceResolve();
    assert.equal(harness.auditMessages.length, 2);
    assert.ok(harness.auditMessages.every((message) => message.flags[MODULE_ID].auditRoll));
    assert.equal(harness.chatMessages.length, 1);
  });

  it('rejects an invalid wins target without throwing', async () => {
    const harness = createHarness();

    await harness.handler.startRollOff({
      dieType: '1d20',
      winsNeeded: 1.5,
      participants: ['u1', 'u2'],
    });

    assert.deepEqual(harness.values.get('activeRollOff'), {});
    assert.equal(harness.notifications.at(-1).type, 'warn');
  });

  it('broadcasts a started contest even when chat creation fails', async () => {
    const harness = createHarness();

    await harness.handler.startRollOff({
      dieType: '1d20',
      winsNeeded: 2,
      participants: ['u1', 'u2'],
    });

    assert.equal(harness.values.get('activeRollOff').active, true);
    assert.ok(harness.hookEvents.some((event) => event.name === 'xandraRollOffs.stateUpdated'));
    assert.ok(harness.hookEvents.some((event) => event.name === 'xandraRollOffs.roundStarted'));
  });

  it('persists force-resolved rolls without advancing the round', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, rollTotals: [18, 12] });

    await harness.handler.forceResolve();

    const stored = harness.values.get('activeRollOff');
    assert.equal(stored.history.length, 0);
    assert.equal(stored.currentRoundIndex, 0);
    assert.equal(stored.roundStack[0].rolls.u1.total, 18);
    assert.equal(stored.roundStack[0].rolls.u2.total, 12);
  });

  it('resolves a complete round only once when advance is triggered concurrently', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    activeRollOff.roundStack[0].rolls = {
      u1: { total: 18 },
      u2: { total: 12 },
    };
    const harness = createHarness({ activeRollOff, postPerRollCard: false });

    await Promise.all([
      harness.handler.advanceRound(),
      harness.handler.advanceRound(),
    ]);

    const roundStarted = harness.hookEvents.filter((event) => event.name === 'xandraRollOffs.roundStarted');
    assert.equal(roundStarted.length, 1);
  });

  it('evaluates only one authoritative roll for concurrent duplicate requests', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, postPerRollCard: false, rollTotals: [18, 4] });

    await Promise.all([
      harness.handler.requestRoll('u1'),
      harness.handler.requestRoll('u1'),
    ]);

    assert.equal(harness.rollCount, 1);
  });

  it('serializes ordinary and forced rolls and posts only one card per participant', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, postPerRollCard: true, chatAvailable: true, rollTotals: [18, 4] });
    await Promise.all([
      harness.handler.requestRoll('u1'), harness.handler.requestRoll('u1'), harness.handler.forceResolve(),
    ]);
    assert.equal(harness.rollCount, 2);
    assert.equal(harness.auditMessages.length, 2);
    assert.equal(new Set(harness.auditMessages.map((message) => message.flags[MODULE_ID].rollKey)).size, 2);
    assert.equal(Object.keys(harness.values.get('activeRollOff').roundStack[0].rolls).length, 2);
  });

  it('routes assistant-GM requests to the designated GM and resolves their acknowledgement', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, postPerRollCard: true, chatAvailable: true });
    const assistant = { id: 'assistant', name: 'Assistant', isGM: true };
    harness.users.set(assistant.id, assistant);
    game.user = assistant;
    game.userId = assistant.id;
    const accepted = harness.handler.requestRoll('u1');
    const request = harness.socketEvents.at(-1).payload;
    assert.equal(request.authorityId, 'gm');
    await harness.dispatch(request); // Assistant must not evaluate its own broadcast.
    assert.equal(harness.rollCount, 0);
    game.user = harness.users.get('gm');
    game.userId = 'gm';
    await harness.dispatch(request);
    const reply = harness.socketEvents.find((event) => event.payload.type === 'requestResult').payload;
    assert.equal(reply.accepted, true);
    game.user = assistant;
    game.userId = assistant.id;
    harness.dispatch(reply);
    assert.equal(await accepted, true);
    assert.equal(harness.rollCount, 1);
    assert.equal(harness.auditMessages.length, 1);
  });

  it('rejects stale round requests and keeps committed chat claims across handler recreation', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, postPerRollCard: true, chatAvailable: true, rollTotals: [18, 4] });
    const context = getRoundContext(activeRollOff);
    await harness.handler.forceResolve();
    const replacement = new RollOffSocketHandler();
    await replacement.requestRoll('u1');
    assert.equal(harness.auditMessages.length, 2);
    assert.equal(harness.rollCount, 2);
    await replacement.advanceRound();
    const result = await replacement._handleRequest({
      type: 'submitRoll', userId: 'u1', requesterId: 'u1', authorityId: 'gm', ...context,
    });
    assert.equal(result, false);
    assert.equal(harness.rollCount, 2);
  });

  it('normalizes remote broadcast payloads to match local hook payloads', () => {
    const harness = createHarness();

    harness.handler._onBroadcast({ type: 'roundStarted', label: 'Round 1' });

    assert.deepEqual(harness.hookEvents.at(-1), {
      name: 'xandraRollOffs.roundStarted',
      payload: { label: 'Round 1' },
    });
  });

  it('contains rejected asynchronous socket tasks', async () => {
    const harness = createHarness();
    harness.handler._onSubmitRoll = async () => {
      throw new Error('settings unavailable');
    };

    harness.dispatch({ type: 'submitRoll', userId: 'u1', requesterId: 'u1', authorityId: 'gm', requestId: 'failed-request' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(harness.notifications.at(-1).message, /submitRoll failed/);
  });
});
