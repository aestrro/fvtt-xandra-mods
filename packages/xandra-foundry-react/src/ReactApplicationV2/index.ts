import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface ApplicationV2Like {
  _preClose(options?: unknown): Promise<void> | void;
}

export type ApplicationV2Constructor = new (...args: any[]) => ApplicationV2Like;

const createReactApplicationV2 = <TBase extends ApplicationV2Constructor>(
  BaseApplicationV2: TBase
) => {
  return class ReactApplicationV2 extends BaseApplicationV2 {
    #mount: HTMLElement | null = null;
    #root: Root | null = null;

    constructor(...args: any[]) {
      super(...args);
    }

    renderReact(): ReactNode {
      throw new Error('ReactApplicationV2 subclasses must implement renderReact().');
    }

    async _renderHTML(): Promise<null> {
      return null;
    }

    _replaceHTML(_result: unknown, content: HTMLElement): void {
      if (!this.#root || this.#mount?.parentElement !== content) {
        this.#unmountReact();
        this.#mount = document.createElement('div');
        this.#mount.className = 'xandra-react-application-root';
        content.replaceChildren(this.#mount);
        this.#root = createRoot(this.#mount);
      }

      this.#root.render(this.renderReact());
    }

    async _preClose(options?: unknown): Promise<void> {
      this.#unmountReact();
      await super._preClose(options);
    }

    #unmountReact(): void {
      this.#root?.unmount();
      this.#mount?.remove();
      this.#root = null;
      this.#mount = null;
    }
  };
};

export default createReactApplicationV2;
