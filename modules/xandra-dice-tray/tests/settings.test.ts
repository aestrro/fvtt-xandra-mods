import { describe, expect, it, vi } from 'vitest';
import { MODULE_HOOKS, MODULE_ID, SETTINGS } from '../src/constants';
import registerSettings from '../src/foundry/registerSettings';

describe('registerSettings', () => {
  it('registers the client visibility setting and publishes refreshes', () => {
    const register = vi.fn();
    const callAll = vi.fn();
    vi.stubGlobal('game', { settings: { register } });
    vi.stubGlobal('Hooks', { callAll });

    registerSettings();

    expect(register).toHaveBeenCalledOnce();
    const [namespace, key, config] = register.mock.calls[0];
    expect(namespace).toBe(MODULE_ID);
    expect(key).toBe(SETTINGS.SHOW_TRAY);
    expect(config.scope).toBe('client');
    expect(config.default).toBe(true);

    config.onChange(false);
    expect(callAll).toHaveBeenCalledWith(MODULE_HOOKS.REFRESH);
  });
});
