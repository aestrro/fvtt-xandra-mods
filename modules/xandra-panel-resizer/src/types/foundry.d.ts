// Minimal Foundry VTT global type declarations for xandra-panel-resizer

declare class Hooks {
  static once(event: string, callback: (...args: any[]) => any): void;
  static on(event: string, callback: (...args: any[]) => any): void;
}

declare const game: {
  settings: {
    register(module: string, key: string, data: Record<string, unknown>): void;
    get(module: string, key: string): any;
    set(module: string, key: string, value: unknown): Promise<void>;
  };
};

declare const ui: {
  sidebar?: {
    element: HTMLElement;
  };
  notifications?: {
    info(message: string, options?: Record<string, unknown>): void;
    warn(message: string, options?: Record<string, unknown>): void;
    error(message: string, options?: Record<string, unknown>): void;
  };
};

declare const canvas: {
  tokens?: {
    controlled: any[];
  };
} | undefined;
