import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRollCommand } from '../scripts/utils.mjs';

describe('parseRollCommand', () => {
  it('accepts /roll and /r with a formula', () => {
    assert.equal(parseRollCommand('/roll 1d20'), '1d20');
    assert.equal(parseRollCommand('/R 2d6'), '2d6');
  });

  it('ignores unrelated slash commands and incomplete rolls', () => {
    assert.equal(parseRollCommand('/ready'), null);
    assert.equal(parseRollCommand('/rolltable goblins'), null);
    assert.equal(parseRollCommand('/r'), null);
  });
});
