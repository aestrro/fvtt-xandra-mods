/**
 * Module Settings
 */
export class Settings {
  static MODULE_ID = 'xandra-panel-resizer';

  /**
   * Register all module settings
   */
  static register(): void {
    // Core sidebar width setting
    game.settings.register(this.MODULE_ID, 'sidebarWidth', {
      name: 'Sidebar Width',
      hint: 'The width of the sidebar in pixels (200-600)',
      scope: 'client',
      config: false,
      type: Number,
      default: 300,
      onChange: (value: number) => {
        const sidebar = ui.sidebar?.element;
        if (sidebar) {
          sidebar.style.setProperty('--sidebar-width', `${value}px`);
        }
      }
    });

    // Enable/disable resizer
    game.settings.register(this.MODULE_ID, 'enableResizer', {
      name: 'Enable Sidebar Resizer',
      hint: 'Show a draggable handle to resize the sidebar',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => {
        window.location.reload();
      }
    });

    // Reset to default button
    game.settings.register(this.MODULE_ID, 'resetWidth', {
      name: 'Reset Sidebar Width',
      hint: 'Click to reset sidebar to default width (300px)',
      scope: 'client',
      config: true,
      type: Boolean,
      default: false,
      onChange: async () => {
        await game.settings.set(this.MODULE_ID, 'sidebarWidth', 300);
        await game.settings.set(this.MODULE_ID, 'resetWidth', false);
        const sidebar = ui.sidebar?.element;
        if (sidebar) {
          sidebar.style.setProperty('--sidebar-width', '300px');
        }
        ui.notifications?.info('Sidebar width reset to 300px');
      }
    });

    console.log('Xandra Panel Resizer: Settings registered');
  }

  static get<T>(key: string): T {
    return game.settings.get(this.MODULE_ID, key) as T;
  }

  static async set(key: string, value: unknown): Promise<void> {
    await game.settings.set(this.MODULE_ID, key, value);
  }
}
