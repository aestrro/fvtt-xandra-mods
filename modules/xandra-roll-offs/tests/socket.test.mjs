import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startRollOff } from '../scripts/state.mjs';
import { RollOffSocketHandler } from '../scripts/socket.mjs';

const MODULE_ID = 'xandra-roll-offs';

function createHarness({ activeRollOff = {}, postPerRollCard = true, rollTotals = [] } = {}) {
  const values = new Map([
    ['activeRollOff', structuredClone(activeRollOff)],
    ['rollOffHistory', []],
    ['winTallies', {}],
    ['postPerRollCard', postPerRollCard],
  ]);
  const socketEvents = [];
  const hookEvents = [];
  const notifications = [];
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
    create: async () => {
      throw new Error('chat unavailable');
    },
  };
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

    async toMessage() {
      throw new Error('audit unavailable');
    }
  };

  return {
    handler: new RollOffSocketHandler(),
    values,
    socketEvents,
    hookEvents,
    notifications,
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

  it('persists force-resolved rolls even when audit cards fail', async () => {
    const activeRollOff = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    const harness = createHarness({ activeRollOff, rollTotals: [18, 12] });

    await harness.handler.forceResolve();

    const stored = harness.values.get('activeRollOff');
    assert.equal(stored.history.length, 1);
    assert.equal(stored.history[0].winner, 'u1');
    assert.equal(stored.currentRoundIndex, 1);
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

    harness.dispatch({ type: 'submitRoll', userId: 'u1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(harness.notifications.at(-1).message, /submitRoll failed/);
  });
});
