import { SidebarResizer } from './sidebar-resizer.js';
import { Settings } from './settings.js';

// Initialize modules
Hooks.once('init', () => {
  console.log('Xandra Panel Resizer | Initializing...');
  Settings.register();
  SidebarResizer.init();
  console.log('Xandra Panel Resizer | Initialization complete');
});

Hooks.once('ready', () => {
  console.log('Xandra Panel Resizer | Ready');
});
