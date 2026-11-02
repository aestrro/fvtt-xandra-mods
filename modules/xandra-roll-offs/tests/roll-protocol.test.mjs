import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRoundContext, getRollKey, sameRound } from '../scripts/roll-protocol.mjs';

describe('roll identities', () => {
  it('distinguishes users, sessions, rounds and recursive tiebreaks without using display labels', () => {
    const state = { active: true, sessionId: 's1', currentRoundIndex: 0, roundStack: [{ label: 'Translated round' }] };
    const original = getRoundContext(state);
    const key = getRollKey(original, 'a');
    assert.notEqual(key, getRollKey(original, 'b'));
    assert.equal(key, getRollKey(getRoundContext({ ...state, roundStack: [{ label: 'Different label' }] }), 'a'));
    assert.notEqual(key, getRollKey(getRoundContext({ ...state, sessionId: 's2' }), 'a'));
    assert.notEqual(key, getRollKey(getRoundContext({ ...state, currentRoundIndex: 1 }), 'a'));
    const tie1 = getRoundContext({ ...state, roundStack: [{ tiebreakIndex: 1 }] });
    const tie2 = getRoundContext({ ...state, roundStack: [{ tiebreakIndex: 2 }] });
    assert.notEqual(key, getRollKey(tie1, 'a'));
    assert.equal(sameRound(tie1, tie2), false);
    assert.equal(sameRound(original, { ...original }), true);
    assert.equal(getRoundContext({ active: false }), null);
    assert.equal(getRollKey(null, 'a'), null);
  });
});
