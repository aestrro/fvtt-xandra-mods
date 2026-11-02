import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRollOff } from '../scripts/state.mjs';

let animation: typeof import('../scripts/animation.mjs');
let prepare: typeof import('../src/foundry/prepareViewModel').prepareViewModel;
let values: Record<string, any>;
let finishDice: (value: boolean) => void;
let showForRoll: ReturnType<typeof vi.fn>;
let notify: (name: string, ...args: any[]) => void;
const motion = { sessionId: 's1', roundKey: '0:0', userId: 'gm', animationId: 'animation-1' };

beforeEach(async () => {
  vi.resetModules();
  const hooks = new Map<string, Function[]>();
  notify = (name, ...args) => { for (const callback of hooks.get(name) ?? []) callback(...args); };
  vi.stubGlobal('Hooks', {
    on: (name: string, callback: Function) => hooks.set(name, [...hooks.get(name) ?? [], callback]),
    callAll: notify,
  });
  const userList = [
    { id: 'gm', name: 'GM', isGM: true, avatar: 'gm.png' },
    { id: 'p1', name: 'Player', isGM: false, avatar: 'player.png' }
  ];
  const users = Object.assign(userList, { get: (id: string) => userList.find((user) => user.id === id) });
  const state = startRollOff({ dieType: '1d20', winsNeeded: 2, participants: ['gm', 'p1'] });
  values = { activeRollOff: { ...state, sessionId: 's1' }, rollOffHistory: [], winTallies: {}, defaultDieType: '1d20', defaultWinsNeeded: 2 };
  const completion = new Promise<boolean>((resolve) => { finishDice = resolve; });
  showForRoll = vi.fn(() => completion);
  vi.stubGlobal('game', {
    userId: 'gm', user: users[0], users, actors: [],
    settings: { get: (_module: string, key: string) => values[key] },
    modules: { get: () => ({ active: true }) },
    dice3d: { showForRoll, isEnabled: () => true },
    i18n: { format: (_key: string, data: any) => `Round ${data.round}` },
  });
  vi.stubGlobal('foundry', { dice: { Roll: { fromData: (data: any) => data } } });
  animation = await import('../scripts/animation.mjs');
  ({ prepareViewModel: prepare } = await import('../src/foundry/prepareViewModel'));
  animation.initRollAnimations();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('dice animation reveal', () => {
  it('withholds a saved value, winner and score until this client finishes DSN, without needing chat', async () => {
    notify('xandraRollOffs.rolling', motion);
    values.activeRollOff.roundStack[0].rolls = { gm: { total: 20 }, p1: { total: 4 } };
    notify('xandraRollOffs.animateRoll', { ...motion, rollData: { total: 20 }, speaker: { alias: 'GM' } });
    let model = prepare();
    expect(model.participantStatuses.find((player) => player.userId === 'gm')?.value).toBeNull();
    expect(model.participantStatuses.find((player) => player.userId === 'gm')?.rolling).toBe(true);
    expect(model.roundComplete).toBe(false);
    expect(model.roundResult).toBeNull();
    expect(model.tracker.find((player) => player.userId === 'gm')?.wins).toBe(0);
    expect(showForRoll).toHaveBeenCalledWith({ total: 20 }, game.users.get('gm'), false, null, false, null, { alias: 'GM' });
    const key = JSON.stringify(['s1', '0:0', 'gm']);
    const settled = animation.waitForRollAnimation(key);
    const element = document.createElement('article');
    const message = { flags: { 'xandra-roll-offs': { rollKey: key } } };
    notify('renderChatMessageHTML', message, element);
    notify('renderChatMessage', message, element);
    expect(element.style.visibility).toBe('hidden');
    finishDice(true);
    await settled;
    await Promise.resolve();
    model = prepare();
    expect(model.participantStatuses.find((player) => player.userId === 'gm')?.value).toBe(20);
    expect(model.roundComplete).toBe(true);
    expect(model.roundResult?.name).toBe('GM');
    expect(model.tracker.find((player) => player.userId === 'gm')?.wins).toBe(1);
    expect(element.style.visibility).toBe('');
  });

  it('reveals normally when DSN is disabled and clears cancelled in-flight rolls', async () => {
    game.dice3d.isEnabled = () => false;
    notify('xandraRollOffs.rolling', motion);
    values.activeRollOff.roundStack[0].rolls.gm = { total: 12 };
    notify('xandraRollOffs.animateRoll', { ...motion, rollData: { total: 12 } });
    expect(animation.hasPendingAnimations('s1')).toBe(false);
    expect(prepare().participantStatuses.find((player) => player.userId === 'gm')?.value).toBe(12);
    expect(showForRoll).not.toHaveBeenCalled();
    notify('xandraRollOffs.rolling', { ...motion, userId: 'p1', animationId: 'animation-2' });
    expect(animation.hasPendingAnimations('s1')).toBe(true);
    notify('xandraRollOffs.rollAnimationCancelled', { sessionId: 's1', roundKey: '0:0', userIds: ['p1'] });
    expect(animation.hasPendingAnimations('s1')).toBe(false);
  });
});
