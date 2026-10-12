import { describe, expect, it, vi } from 'vitest';
import executeRoll from '../src/foundry/executeRoll';

describe('executeRoll', () => {
  it('posts the roll with Foundry speaker and core roll mode', async () => {
    const toMessage = vi.fn().mockResolvedValue(undefined);
    const getSpeaker = vi.fn().mockReturnValue({ alias: 'Tester' });
    const getSetting = vi.fn().mockReturnValue('gmroll');

    vi.stubGlobal('Roll', class {
      constructor(readonly formula: string) {}
      toMessage = toMessage;
    });
    vi.stubGlobal('ChatMessage', { getSpeaker });
    vi.stubGlobal('game', {
      settings: { get: getSetting },
      i18n: { format: vi.fn() }
    });
    vi.stubGlobal('ui', { notifications: { error: vi.fn() } });

    const succeeded = await executeRoll('2d6');

    expect(toMessage).toHaveBeenCalledWith(
      {
        speaker: { alias: 'Tester' },
        flavor: '2d6'
      },
      { rollMode: 'gmroll' }
    );
    expect(getSetting).toHaveBeenCalledWith('core', 'rollMode');
    expect(succeeded).toBe(true);
  });
});
