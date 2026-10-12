import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export type MountPosition = 'before' | 'after' | 'prepend' | 'append';

export interface ReactMountContext {
  container: HTMLElement;
  key: string;
}

export interface ReactMountDefinition {
  key: string;
  resolveAnchor: () => Element | null;
  render: (context: ReactMountContext) => ReactNode;
  position?: MountPosition;
  shouldMount?: () => boolean;
  className?: string;
  attributes?: Record<string, string>;
}

interface ActiveMount {
  anchor: Element;
  container: HTMLElement;
  root: Root;
}

const insertContainer = (
  anchor: Element,
  container: HTMLElement,
  position: MountPosition
): void => {
  switch (position) {
    case 'after':
      anchor.after(container);
      return;
    case 'prepend':
      anchor.prepend(container);
      return;
    case 'append':
      anchor.append(container);
      return;
    case 'before':
    default:
      anchor.before(container);
  }
};

class ReactMountRegistry {
  readonly #definitions = new Map<string, ReactMountDefinition>();
  readonly #mounts = new Map<string, ActiveMount>();

  register(definition: ReactMountDefinition): () => void {
    if (this.#definitions.has(definition.key)) {
      throw new Error(`React mount key already registered: ${definition.key}`);
    }

    this.#definitions.set(definition.key, definition);

    return () => {
      this.unmount(definition.key);
      this.#definitions.delete(definition.key);
    };
  }

  reconcile(key?: string): void {
    if (key) {
      const definition = this.#definitions.get(key);
      if (definition) this.#reconcileDefinition(definition);
      return;
    }

    for (const definition of this.#definitions.values()) {
      this.#reconcileDefinition(definition);
    }
  }

  unmount(key: string): void {
    const activeMount = this.#mounts.get(key);
    if (!activeMount) return;

    activeMount.root.unmount();
    activeMount.container.remove();
    this.#mounts.delete(key);
  }

  destroy(): void {
    for (const key of [...this.#mounts.keys()]) this.unmount(key);
    this.#definitions.clear();
  }

  isMounted(key: string): boolean {
    return this.#mounts.has(key);
  }

  getMountedKeys(): string[] {
    return [...this.#mounts.keys()];
  }

  #reconcileDefinition(definition: ReactMountDefinition): void {
    if (definition.shouldMount && !definition.shouldMount()) {
      this.unmount(definition.key);
      return;
    }

    const anchor = definition.resolveAnchor();
    if (!anchor) {
      this.unmount(definition.key);
      return;
    }

    let activeMount = this.#mounts.get(definition.key);
    const anchorChanged = activeMount?.anchor !== anchor;
    const mountDetached = activeMount ? !activeMount.container.isConnected : false;

    if (activeMount && (anchorChanged || mountDetached)) {
      this.unmount(definition.key);
      activeMount = undefined;
    }

    if (!activeMount) {
      const container = document.createElement('div');
      container.className = definition.className ?? 'xandra-react-root';
      container.dataset.xandraReactMount = definition.key;

      for (const [name, value] of Object.entries(definition.attributes ?? {})) {
        container.setAttribute(name, value);
      }

      insertContainer(anchor, container, definition.position ?? 'before');
      activeMount = {
        anchor,
        container,
        root: createRoot(container)
      };
      this.#mounts.set(definition.key, activeMount);
    }

    activeMount.root.render(
      definition.render({
        container: activeMount.container,
        key: definition.key
      })
    );
  }
}

export default ReactMountRegistry;
