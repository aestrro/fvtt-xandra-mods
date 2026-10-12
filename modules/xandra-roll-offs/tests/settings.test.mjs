import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerSettings, SETTINGS } from '../scripts/settings.mjs';

describe('setting change hooks', () => {
  let registrations;
  let hookEvents;

  beforeEach(() => {
    registrations = new Map();
    hookEvents = [];
    globalThis.document = { querySelector: () => null };
    globalThis.game = {
      settings: {
        register: (moduleId, key, config) => registrations.set(key, config),
      },
    };
    globalThis.Hooks = {
      callAll: (name, payload) => hookEvents.push({ name, payload }),
    };
    globalThis.ui = { sidebar: { render: () => {} } };
    registerSettings();
  });

  it('requests a chat-button visibility resync', () => {
    registrations.get(SETTINGS.SHOW_CHAT_BUTTON).onChange(false);
    assert.deepEqual(hookEvents, [
      { name: 'xandraRollOffs.chatButtonSettingChanged', payload: false },
    ]);
  });

  it('requests a sidebar-toggle visibility resync', () => {
    registrations.get(SETTINGS.SHOW_SIDEBAR_TAB).onChange(false);
    assert.deepEqual(hookEvents, [
      { name: 'xandraRollOffs.sidebarSettingChanged', payload: false },
    ]);
  });
});
