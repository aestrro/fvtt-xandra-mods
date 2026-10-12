type FoundryHookCallback = (...args: any[]) => void;

declare const Hooks: {
  callAll: (hook: string, ...args: any[]) => void;
  off?: (hook: string, callback: FoundryHookCallback) => void;
  on: (hook: string, callback: FoundryHookCallback) => number;
  once: (hook: string, callback: FoundryHookCallback) => number;
};

declare const game: {
  i18n: {
    format: (key: string, data: Record<string, unknown>) => string;
    localize: (key: string) => string;
  };
  modules: Map<string, { api?: unknown; version: string }>;
  settings: {
    get: <T = unknown>(namespace: string, key: string) => T;
    register: (
      namespace: string,
      key: string,
      config: {
        config: boolean;
        default: unknown;
        hint: string;
        name: string;
        onChange?: (value: unknown) => void;
        scope: 'client' | 'world';
        type: BooleanConstructor | NumberConstructor | ObjectConstructor | StringConstructor;
      }
    ) => void;
  };
  system?: {
    id?: string;
  };
};

declare const ui: {
  notifications: {
    error: (message: string) => void;
    warn: (message: string) => void;
  };
};

declare const ChatMessage: {
  getSpeaker: () => unknown;
};

declare const Roll: new (formula: string) => {
  toMessage: (
    messageData: { flavor: string; speaker: unknown },
    options: { rollMode: unknown }
  ) => Promise<unknown>;
};
