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
    vi.stubGlobal('game', {
      userId: 'gm', user: { isGM: true },
      settings: { get: (_module: string, key: string) => key === 'activeRollOff' ? active : {}, set: vi.fn() }
    });
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
    expect(RollOffWindow.activeWindow).toBe(true);
    expect(instances[1].renderCount).toBe(2);
  });

  it('restores an open GM or assistant-GM setup panel after reload and respects manual closes', async () => {
    let panels: Record<string, boolean> = {};
    vi.stubGlobal('foundry', { applications: { api: { ApplicationV2: FakeApplication } } });
    vi.stubGlobal('Hooks', { on: vi.fn(() => 1) });
    const user = { isGM: true, role: 3 };
    vi.stubGlobal('game', {
      userId: 'assistant', user,
      settings: {
        get: (_module: string, key: string) => key === 'openGmPanels' ? panels : {},
        set: vi.fn(async (_module: string, _key: string, value: Record<string, boolean>) => { panels = value; })
      }
    });
    let { RollOffWindow } = await import('../src/foundry/RollOffWindow');
    await RollOffWindow.restore();
    expect(instances).toHaveLength(0);
    await RollOffWindow.open();
    expect(panels).toEqual({ assistant: true });
    vi.resetModules();
    ({ RollOffWindow } = await import('../src/foundry/RollOffWindow'));
    await RollOffWindow.restore();
    expect(RollOffWindow.activeWindow).toBe(true);
    expect(instances).toHaveLength(2);
    await RollOffWindow.close();
    expect(panels).toEqual({ assistant: false });
    vi.resetModules();
    ({ RollOffWindow } = await import('../src/foundry/RollOffWindow'));
    await RollOffWindow.restore();
    expect(RollOffWindow.activeWindow).toBe(false);
    expect(instances).toHaveLength(2);
  });

  it('uses per-user preferences and does not reopen a manually closed GM panel for an active session on reload', async () => {
    let panels: Record<string, boolean> = { gm: false, assistant: true };
    vi.stubGlobal('foundry', { applications: { api: { ApplicationV2: FakeApplication } } });
    vi.stubGlobal('Hooks', { on: vi.fn(() => 1) });
    const game = {
      userId: 'gm', user: { isGM: true },
      settings: {
        get: (_module: string, key: string) => key === 'openGmPanels' ? panels : { active: true },
        set: vi.fn(async (_module: string, _key: string, value: Record<string, boolean>) => { panels = value; })
      }
    };
    vi.stubGlobal('game', game);
    const { RollOffWindow } = await import('../src/foundry/RollOffWindow');
    await RollOffWindow.restore();
    expect(instances).toHaveLength(0);
    game.userId = 'assistant';
    await RollOffWindow.restore();
    expect(RollOffWindow.activeWindow).toBe(true);
    await RollOffWindow.close();
    expect(panels).toEqual({ gm: false, assistant: false });
  });

  it('returns an open GM history window to setup when session state is removed', async () => {
    let active: Record<string, unknown> = { active: true };
    vi.stubGlobal('foundry', { applications: { api: { ApplicationV2: FakeApplication } } });
    vi.stubGlobal('Hooks', { on: vi.fn(() => 1) });
    vi.stubGlobal('game', {
      userId: 'gm', user: { isGM: true }, users: { map: () => [], get: () => ({ id: 'gm', name: 'GM', isGM: true }) },
      settings: {
        get: (_module: string, key: string) => key === 'activeRollOff' ? active : key === 'rollOffHistory' ? [] : {},
        set: vi.fn()
      }
    });
    const { RollOffWindow } = await import('../src/foundry/RollOffWindow');
    await RollOffWindow.open();
    RollOffWindow.toggleHistory();
    active = {};
    RollOffWindow.onStateChanged();
    expect(RollOffWindow.activeWindow).toBe(true);
    expect(instances[0].renderCount).toBe(3);
    const element = (instances[0] as unknown as { renderReact(): { props: { showHistory: boolean; model: { hasData: boolean } } } }).renderReact();
    expect(element.props.showHistory).toBe(false);
    expect(element.props.model.hasData).toBe(false);
  });

  it('keeps player startup and session-removal behavior unchanged without persisting GM preferences', async () => {
    let active: Record<string, unknown> = { active: true };
    const set = vi.fn();
    vi.stubGlobal('foundry', { applications: { api: { ApplicationV2: FakeApplication } } });
    vi.stubGlobal('Hooks', { on: vi.fn(() => 1) });
    vi.stubGlobal('game', {
      userId: 'player', user: { isGM: false },
      settings: { get: () => active, set }
    });
    const { RollOffWindow } = await import('../src/foundry/RollOffWindow');
    await RollOffWindow.restore();
    expect(RollOffWindow.activeWindow).toBe(true);
    active = {};
    RollOffWindow.onStateChanged();
    await vi.waitFor(() => expect(RollOffWindow.activeWindow).toBe(false));
    expect(set).not.toHaveBeenCalled();
  });
});
