import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MODULE_ID = 'xandra-roll-offs';
let commands: typeof import('../scripts/main.mjs');
let requestRoll: ReturnType<typeof vi.fn>;
let state: any;

beforeEach(async () => {
  vi.resetModules();
  requestRoll = vi.fn().mockResolvedValue(true);
  state = {
    active: true, sessionId: 's1', currentRoundIndex: 0, dieType: '1d20',
    participants: ['p1'], roundStack: [{ participants: ['p1'], rolls: {}, label: 'Round 1' }],
  };
  vi.stubGlobal('Hooks', { once: vi.fn(), on: vi.fn() });
  vi.stubGlobal('game', {
    userId: 'p1', user: { id: 'p1', isGM: false }, messages: [],
    settings: { get: () => state },
    modules: { get: () => ({ socketHandler: { requestRoll } }) },
    i18n: { localize: (key: string) => key, format: (key: string) => key },
  });
  vi.stubGlobal('ui', { notifications: { warn: vi.fn() } });
  commands = await import('../scripts/main.mjs');
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('roll command chat suppression', () => {
  it('tags and suppresses native copies before chat creation without creating a second request', () => {
    const data: any = { flags: { anotherModule: { keep: true } } };
    expect(commands.onChatMessage(null, '/roll 1d20', data)).toBe(false);
    expect(data.flags[MODULE_ID].interceptedRoll.rollKey).toBe(JSON.stringify(['s1', '0:0', 'p1']));
    expect(data.flags.anotherModule.keep).toBe(true);
    expect(commands.onPreCreateChatMessage({ flags: data.flags }, data, {}, 'p1')).toBe(false);
    expect(commands.onPreCreateChatMessage({ flags: data.flags }, data, {}, 'p1')).toBe(false);
    expect(requestRoll).toHaveBeenCalledTimes(1);
  });

  it('suppresses repeated explicit commands even after the participant already rolled', () => {
    state.roundStack[0].rolls.p1 = { total: 12 };
    const data: any = {};
    expect(commands.onChatMessage(null, '/roll d20', data)).toBe(false);
    expect(commands.onPreCreateChatMessage({}, data, {}, 'p1')).toBe(false);
    expect(requestRoll).toHaveBeenCalledWith('p1');
  });

  it('leaves same-formula macro rolls and unrelated messages untouched', async () => {
    commands.onChatMessage(null, '/roll 1d20', {});
    const message = { author: { id: 'p1' }, flags: {}, rolls: [{ formula: '1d20' }], delete: vi.fn() };
    expect(commands.onPreCreateChatMessage(message, {}, {}, 'p1')).toBeUndefined();
    await commands.onCreateChatMessage(message, {}, 'p1');
    expect(message.delete).not.toHaveBeenCalled();
    expect(commands.onChatMessage(null, '/roll 1d6', {})).toBeUndefined();
    state.roundStack[0].participants = ['someoneElse'];
    expect(commands.onChatMessage(null, '/roll 1d20', {})).toBeUndefined();
  });

  it('cleans tagged copies for players only after authoritative acceptance', async () => {
    const data: any = {};
    commands.onChatMessage(null, '/roll 1d20', data);
    const message = { author: { id: 'p1' }, flags: data.flags, isOwner: true, delete: vi.fn() };
    await commands.onCreateChatMessage(message, {}, 'p1');
    await commands.onCreateChatMessage(message, {}, 'p1');
    expect(message.delete).toHaveBeenCalledTimes(2);
    expect(requestRoll).toHaveBeenCalledTimes(1);
  });

  it('does not delete tagged messages when the request was rejected or failed', async () => {
    for (const rejected of [false, new Error('Network failed')]) {
      requestRoll.mockImplementationOnce(() => rejected instanceof Error ? Promise.reject(rejected) : Promise.resolve(rejected));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const data: any = {};
      commands.onChatMessage(null, '/roll 1d20', data);
      const message = { author: { id: 'p1' }, flags: data.flags, isOwner: true, delete: vi.fn() };
      await commands.onCreateChatMessage(message, {}, 'p1');
      expect(message.delete).not.toHaveBeenCalled();
    }
  });

  it('prevents re-created canonical cards with the same roll key without blocking new ones', () => {
    const flags = { auditRoll: true, rollKey: 'existing-key' };
    game.messages.push({ flags: { [MODULE_ID]: flags } });
    expect(commands.onPreCreateChatMessage({}, { flags: { [MODULE_ID]: flags } }, {}, 'p1')).toBe(false);
    expect(commands.onPreCreateChatMessage({}, { flags: { [MODULE_ID]: { ...flags, rollKey: 'new-key' } } }, {}, 'p1')).toBeUndefined();
    expect(requestRoll).not.toHaveBeenCalled();
  });
});
