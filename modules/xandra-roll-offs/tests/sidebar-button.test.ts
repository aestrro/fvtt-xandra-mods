import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSidebarTab } from '../scripts/apps/RollOffSidebarTab.mjs';

let hooks: Map<string, () => void>;

beforeEach(() => {
  hooks = new Map();
  document.body.innerHTML = '<nav id="sidebar-tabs"><menu class="flexcol"><li><button data-tab="settings"></button></li></menu></nav>';
  vi.stubGlobal('Hooks', { on: (name: string, callback: () => void) => hooks.set(name, callback) });
  vi.stubGlobal('ui', { sidebar: { rendered: true } });
});
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

describe('roll-off sidebar button', () => {
  it('renders without game.settings.has and opens the panel for every user role', () => {
    // Foundry settings has get/register/set; no invented has() requirement.
    vi.stubGlobal('game', { settings: { get: () => true } });
    const window = { activeWindow: false, open: vi.fn(), close: vi.fn() };
    registerSidebarTab(window);
    const button = document.querySelector('#xro-sidebar-tab-btn') as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    expect(window.open).toHaveBeenCalledTimes(1);
    hooks.get('renderSidebar')?.();
    expect(document.querySelectorAll('#xro-sidebar-tab-btn')).toHaveLength(1);
  });

  it('waits for settings registration and respects the visibility preference', () => {
    let registered = false;
    let visible = true;
    vi.stubGlobal('game', { settings: { get: () => {
      if (!registered) throw new Error('Not registered');
      return visible;
    } } });
    registerSidebarTab({ activeWindow: false, open: vi.fn(), close: vi.fn() });
    expect(document.querySelector('#xro-sidebar-tab-btn')).toBeNull();
    registered = true;
    hooks.get('renderSidebar')?.();
    expect(document.querySelector('#xro-sidebar-tab-btn')).not.toBeNull();
    visible = false;
    hooks.get('xandraRollOffs.sidebarSettingChanged')?.();
    expect(document.querySelector('#xro-sidebar-tab-btn')).toBeNull();
  });
});
