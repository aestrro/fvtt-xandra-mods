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

  it('keeps per-user panel visibility in a hidden client setting', () => {
    const setting = registrations.get(SETTINGS.OPEN_GM_PANELS);
    assert.equal(setting.scope, 'client');
    assert.equal(setting.config, false);
    assert.equal(setting.type, Object);
    assert.deepEqual(setting.default, {});
  });

  it('defaults optional chat messages to off with world-wide controls', () => {
    for (const key of [SETTINGS.POST_PER_ROLL_CARD, SETTINGS.POST_ROUND_ANNOUNCEMENTS, SETTINGS.POST_TIEBREAK_ANNOUNCEMENTS]) {
      const setting = registrations.get(key);
      assert.equal(setting.scope, 'world');
      assert.equal(setting.config, true);
      assert.equal(setting.default, false);
    }
  });
});
