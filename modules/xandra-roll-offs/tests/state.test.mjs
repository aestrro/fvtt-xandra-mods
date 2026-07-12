import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  startRollOff,
  submitRoll,
  canUserRoll,
  resolveRound,
  onAllRolledIn,
  advanceToNextRoundOrEnd,
  findActiveRound,
  getPendingRollers,
  isRoundComplete,
} from '../scripts/state.mjs';

describe('startRollOff', () => {
  it('creates an active roll-off with the given config', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(ro.active, true);
    assert.equal(ro.dieType, '1d20');
    assert.equal(ro.winsNeeded, 2);
    assert.deepEqual(ro.participants, ['u1', 'u2']);
    assert.equal(ro.currentRoundIndex, 0);
    assert.equal(ro.roundStack.length, 1);
    assert.equal(ro.history.length, 0);
    assert.equal(findActiveRound(ro.roundStack).label, 'Round 1');
  });

  it('throws on missing dieType', () => {
    assert.throws(() => startRollOff({ winsNeeded: 2, participants: ['u1', 'u2'] }), /dieType/);
  });

  it('throws on invalid winsNeeded', () => {
    assert.throws(() => startRollOff({ dieType: '1d20', winsNeeded: 0, participants: ['u1', 'u2'] }), /winsNeeded/);
  });

  it('throws with fewer than two participants', () => {
    assert.throws(() => startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1'] }), /participants/);
  });
});

describe('submitRoll', () => {
  it('records a valid roll and returns true', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(submitRoll(ro, 'u1', { total: 15 }), true);
    assert.equal(ro.roundStack[0].rolls.u1.total, 15);
  });

  it('rejects a duplicate roll', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    submitRoll(ro, 'u1', { total: 15 });
    assert.equal(submitRoll(ro, 'u1', { total: 18 }), false);
  });

  it('rejects a non-participant', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(submitRoll(ro, 'u3', { total: 20 }), false);
  });

  it('rejects an invalid roll result', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(submitRoll(ro, 'u1', { total: 'high' }), false);
    assert.equal(submitRoll(ro, 'u1', null), false);
  });
});

describe('canUserRoll', () => {
  it('returns true for a participant who has not rolled', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    assert.equal(canUserRoll(ro, 'u1'), true);
  });

  it('returns false after a participant has rolled', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    submitRoll(ro, 'u1', { total: 15 });
    assert.equal(canUserRoll(ro, 'u1'), false);
  });
});

describe('resolveRound', () => {
  it('returns the single winner', () => {
    const result = resolveRound({ u1: { total: 18 }, u2: { total: 12 } });
    assert.equal(result.type, 'winner');
    assert.equal(result.userId, 'u1');
  });

  it('returns a tie when two users share the high roll', () => {
    const result = resolveRound({ u1: { total: 15 }, u2: { total: 15 } });
    assert.equal(result.type, 'tie');
    assert.deepEqual(result.userIds, ['u1', 'u2']);
  });

  it('returns an empty tie for no rolls', () => {
    const result = resolveRound({});
    assert.equal(result.type, 'tie');
    assert.deepEqual(result.userIds, []);
  });
});

describe('onAllRolledIn', () => {
  it('advances to the next round after a winner', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    submitRoll(ro, 'u1', { total: 18 });
    submitRoll(ro, 'u2', { total: 12 });

    const result = onAllRolledIn(ro);
    assert.equal(result.type, 'winner');
    assert.equal(result.winnerId, 'u1');
    assert.equal(ro.currentRoundIndex, 1);
    assert.equal(findActiveRound(ro.roundStack).label, 'Round 2');
    assert.equal(ro.history.length, 1);
    assert.equal(ro.history[0].winner, 'u1');
  });

  it('creates a tiebreak round when tied', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2', 'u3'] });
    submitRoll(ro, 'u1', { total: 15 });
    submitRoll(ro, 'u2', { total: 15 });
    submitRoll(ro, 'u3', { total: 10 });

    const result = onAllRolledIn(ro);
    assert.equal(result.type, 'tiebreak');
    assert.deepEqual(result.tiebreak.participants, ['u1', 'u2']);
    assert.equal(result.tiebreak.label, 'Round 1 - Tiebreak');
    assert.equal(ro.roundStack.length, 2);
  });

  it('keeps the roll-off active after a single round win', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 3, participants: ['u1', 'u2'] });
    submitRoll(ro, 'u1', { total: 20 });
    submitRoll(ro, 'u2', { total: 5 });

    onAllRolledIn(ro);
    assert.equal(ro.active, true);
  });
});

describe('round helpers', () => {
  it('reports pending rollers', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2', 'u3'] });
    submitRoll(ro, 'u1', { total: 10 });
    assert.deepEqual(getPendingRollers(ro), ['u2', 'u3']);
  });

  it('reports a round complete when all participants have rolled', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    submitRoll(ro, 'u1', { total: 10 });
    assert.equal(isRoundComplete(ro), false);
    submitRoll(ro, 'u2', { total: 12 });
    assert.equal(isRoundComplete(ro), true);
  });
});

describe('advanceToNextRoundOrEnd', () => {
  it('pushes the next round while active', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    advanceToNextRoundOrEnd(ro);
    assert.equal(ro.currentRoundIndex, 1);
    assert.equal(findActiveRound(ro.roundStack).label, 'Round 2');
    assert.equal(ro.active, true);
  });

  it('does nothing when the roll-off is inactive', () => {
    const ro = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['u1', 'u2'] });
    ro.active = false;
    advanceToNextRoundOrEnd(ro);
    assert.equal(ro.roundStack.length, 0);
  });
});
