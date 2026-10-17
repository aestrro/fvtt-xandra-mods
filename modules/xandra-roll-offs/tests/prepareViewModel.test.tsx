import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareViewModel } from '../src/foundry/prepareViewModel';
import { startRollOff } from '../scripts/state.mjs';

const userList = [
  { id: 'gm', name: 'GM', isGM: true, active: true, avatar: 'gm.png' },
  { id: 'a', name: 'Alice', isGM: false, active: true, character: { name: 'Archer', img: 'a.png' } },
  { id: 'b', name: 'Bob', isGM: false, active: true, character: { name: 'Bard', img: 'b.png' } }
];
const users = Object.assign(userList, { get: (id: string) => userList.find((user) => user.id === id) });

const prepare = (active: any, sessions: any[] = []) => {
  const values: Record<string, unknown> = {
    activeRollOff: active, rollOffHistory: sessions, winTallies: {}, defaultDieType: '1d20',
    defaultWinsNeeded: 2, includeGMByDefault: true
  };
  vi.stubGlobal('game', {
    user: users[0], userId: 'gm', users, actors: [],
    settings: { get: (_module: string, key: string) => values[key] },
    i18n: { format: (_key: string, data: { round: number }) => `Round ${data.round}` }
  });
  return prepareViewModel();
};

afterEach(() => vi.unstubAllGlobals());

describe('roll-off display projection', () => {
  it('keeps completed sessions available without an active contest', () => {
    const model = prepare({}, [{ id: 's1', winner: 'a', participants: ['a', 'b'],
      startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-02T00:00:00Z', history: [] }]);
    expect(model.hasData).toBe(false);
    expect(model.sessionHistory[0].winnerName).toBe('Archer');
    expect(model.sessionHistory[0].endedLabel).toBeTruthy();
  });

  it('shows only the current round winner as a provisional scoreboard point', () => {
    const active = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['a', 'b'] });
    active.roundStack[0].rolls = { a: { total: 20 }, b: { total: 5 } };
    const model = prepare(active);
    expect(model.roundComplete).toBe(true);
    expect(model.roundResult?.name).toBe('Archer');
    expect(model.tracker.find((user) => user.userId === 'a')?.wins).toBe(1);
    expect(model.tracker.find((user) => user.userId === 'b')?.wins).toBe(0);
    expect(model.participantStatuses.every((user) => user.rolled)).toBe(true);
  });

  it('shows a tie without awarding a provisional point', () => {
    const active = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['a', 'b'] });
    active.roundStack[0].rolls = { a: { total: 12 }, b: { total: 12 } };
    const model = prepare(active);
    expect(model.roundResult?.tieNames).toBe('Archer, Bard');
    expect(model.tracker.every((user) => user.wins === 0)).toBe(true);
  });
});
