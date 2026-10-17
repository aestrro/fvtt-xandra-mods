import { afterEach, describe, expect, it, vi } from 'vitest';

const instances: FakeApplication[] = [];
class FakeApplication {
  rendered = false;
  renderCount = 0;
  constructor(..._args: unknown[]) { instances.push(this); }
  async render() { this.rendered = true; this.renderCount += 1; }
  async close() { this.rendered = false; await this._preClose(); }
  async _preClose() {}
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); instances.length = 0; });

describe('React RollOffWindow lifecycle', () => {
  it('rerenders an open window but does not reopen a manually closed one', async () => {
    let active: Record<string, unknown> = { active: true };
    vi.stubGlobal('foundry', { applications: { api: { ApplicationV2: FakeApplication } } });
    vi.stubGlobal('Hooks', { on: vi.fn(() => 1) });
    vi.stubGlobal('game', { settings: { get: () => active } });
    const { RollOffWindow } = await import('../src/foundry/RollOffWindow');

    await RollOffWindow.open();
    expect(RollOffWindow.activeWindow).toBe(true);
    RollOffWindow.onStateChanged();
    expect(instances[0].renderCount).toBe(2);
    await RollOffWindow.close();
    RollOffWindow.onStateChanged();
    expect(instances[0].rendered).toBe(false);
    expect(instances).toHaveLength(1);

    await RollOffWindow.open();
    expect(instances).toHaveLength(2);
    active = {};
    RollOffWindow.onStateChanged();
    await vi.waitFor(() => expect(RollOffWindow.activeWindow).toBe(false));
  });
});
