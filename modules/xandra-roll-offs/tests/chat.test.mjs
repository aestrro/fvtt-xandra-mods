import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postRoundStarted } from '../scripts/chat.mjs';

describe('postRoundStarted', () => {
  it('renders participant names in the round-start card', async () => {
    const users = new Map([
      ['u1', { id: 'u1', name: 'Alice' }],
      ['u2', { id: 'u2', name: 'Bob' }],
    ]);
    users.activeGM = { id: 'gm', name: 'GM' };

    globalThis.game = {
      users,
      user: users.activeGM,
      i18n: {
        localize: (key) => key,
      },
    };
    globalThis.ChatMessage = {
      getSpeaker: () => ({ alias: 'GM' }),
      create: async (data) => data,
    };

    const message = await postRoundStarted(
      { label: 'Round 1', parent: null },
      ['u1', 'u2'],
      '1d20'
    );

    assert.match(message.content, /Alice, Bob/);
    assert.match(message.content, /Round 1 Started/);
  });

  it('uses the explicit recursive tiebreak number', async () => {
    const users = new Map([
      ['u1', { id: 'u1', name: 'Alice' }],
      ['u2', { id: 'u2', name: 'Bob' }],
    ]);
    users.activeGM = { id: 'gm', name: 'GM' };

    globalThis.game = {
      users,
      user: users.activeGM,
      i18n: {
        localize: (key) => key,
      },
    };
    globalThis.ChatMessage = {
      getSpeaker: () => ({ alias: 'GM' }),
      create: async (data) => data,
    };

    const message = await postRoundStarted(
      { label: 'Round 1 - Tiebreak #2', parent: {}, tiebreakIndex: 2 },
      ['u1', 'u2'],
      '1d20'
    );

    assert.match(message.content, /Tie-Break #2 Started/);
  });
});
