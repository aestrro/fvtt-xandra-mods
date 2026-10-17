import { createReactApplicationV2 } from '@xandra/foundry-react';
import RollOffApp, { type RollOffAction } from '../../components/RollOffApp';
import { prepareViewModel } from '../prepareViewModel';
import { getActiveRollOff } from '../../../scripts/settings.mjs';
import { canUserRoll } from '../../../scripts/state.mjs';
import { MODULE_ID } from '../../../scripts/utils.mjs';

type FoundryWindow = {
  _preClose(options?: unknown): Promise<void>;
  render(options?: unknown): Promise<unknown>;
  close(options?: unknown): Promise<void>;
  rendered: boolean;
};
const BaseWindow = createReactApplicationV2(
  foundry.applications.api.ApplicationV2 as new (...args: any[]) => FoundryWindow
);

/** Foundry chrome and lifecycle only; the UI lives in React function components. */
export class RollOffWindow extends BaseWindow {
  static #instance: RollOffWindow | null = null;
  static #hookId: number | null = null;
  #showHistory = false;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-window',
    classes: ['xandra-roll-offs-window'],
    tag: 'div',
    window: {
      title: 'Roll-Off',
      resizable: true,
      controls: [{ icon: 'fas fa-clock-rotate-left', label: 'History', action: 'toggleHistory', tooltip: 'View session history' }]
    },
    position: { width: 420, height: 560 },
    actions: { toggleHistory: RollOffWindow.toggleHistory }
  };

  static open(options: Record<string, unknown> = {}) {
    if (!this.#instance) this.#instance = new this();
    return this.#instance.render({ force: true, ...options });
  }

  static close() {
    if (this.#instance?.rendered) return this.#instance.close();
  }

  static get activeWindow(): boolean {
    return this.#instance?.rendered ?? false;
  }

  static onStateChanged() {
    const active = getActiveRollOff();
    if (!active || Object.keys(active).length === 0) {
      void this.close();
    } else if (this.#instance?.rendered) {
      void this.#instance.render({ force: true });
    }
  }

  static toggleHistory() {
    const instance = RollOffWindow.#instance;
    if (!instance) return;
    instance.#showHistory = !instance.#showHistory;
    void instance.render({ force: true });
  }

  constructor(...args: any[]) {
    super(...args);
    if (RollOffWindow.#hookId === null) {
      RollOffWindow.#hookId = Hooks.on('xandraRollOffs.stateUpdated', () => RollOffWindow.onStateChanged());
    }
  }

  async close(options?: unknown): Promise<void> {
    RollOffWindow.#instance = null;
    await super.close(options);
  }

  renderReact() {
    return <RollOffApp model={prepareViewModel()} showHistory={this.#showHistory}
      onAction={(action, payload) => this.#dispatch(action, payload)} />;
  }

  async #dispatch(action: RollOffAction, payload?: any): Promise<unknown> {
    if (action === 'closeWindow') return this.close();
    if (action !== 'roll' && !game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID)?.socketHandler;
    if (!socket) {
      console.error(`${MODULE_ID} | Socket handler unavailable`);
      ui.notifications.error('Roll-Off controls are still initializing. Try again in a moment.');
      return;
    }
    try {
      switch (action) {
        case 'roll': return await socket.requestRoll(game.userId);
        case 'rollFor':
          if (!canUserRoll(getActiveRollOff() as any, payload)) return;
          return await socket.requestRoll(payload);
        case 'start':
          await socket.startRollOff(payload);
          return true;
        case 'cancel': return await socket.cancelRollOff();
        case 'closeRollOff': return await socket.closeRollOff();
        case 'forceResolve': return await socket.forceResolve();
        case 'advance': return await socket.advanceRound();
      }
    } catch (error) {
      console.error(`${MODULE_ID} | ${action} failed`, error);
      ui.notifications.error(`Roll-Off action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
