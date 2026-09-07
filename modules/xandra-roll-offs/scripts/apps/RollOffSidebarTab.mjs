import { RollOffWindow } from './RollOffWindow.mjs';
import { getActiveRollOff, getWinTallies, SETTINGS } from '../settings.mjs';
import { findActiveRound } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

const { AbstractSidebarTab } = foundry.applications.sidebar;

/**
 * Sidebar launcher for the dedicated Roll-Off window.
 *
 * Shows the current roll-off status at a glance and opens the full theatre window
 * when clicked. It is intentionally lightweight: the main UI lives in RollOffWindow.
 */
export class RollOffSidebarTab extends AbstractSidebarTab {
  static tabName = 'roll-offs';

  static DEFAULT_OPTIONS = {
    id: 'roll-offs',
    template: 'modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs',
    title: 'XANDRA_ROLL_OFFS.Name',
  };

  /** @override */
  async _prepareContext() {
    const activeRollOff = getActiveRollOff();
    const tallies = getWinTallies();
    const isActive = activeRollOff?.active ?? false;
    const activeRound = isActive ? findActiveRound(activeRollOff.roundStack) : undefined;

    let roundLabel = '';
    let leaderboard = [];

    if (isActive && activeRound) {
      roundLabel = activeRound.label;
      leaderboard = (activeRollOff?.participants ?? [])
        .map((userId) => ({
          name: game.users.get(userId)?.name ?? userId,
          score: tallies[userId] || 0,
        }))
        .sort((a, b) => b.score - a.score);
    }

    return {
      isActive,
      roundLabel,
      leaderboard,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;
    html.querySelector('[data-action="open-roll-off-window"]')?.addEventListener('click', () => this._onOpenWindow());
  }

  _onOpenWindow() {
    RollOffWindow.open();
  }
}

/**
 * Inject a Roll-Offs toggle button into the sidebar tab navigation. The button
 * prevents the native tab-switching behavior and instead toggles the dedicated
 * Roll-Off window for all users, regardless of whether a roll-off is active.
 */
export function registerSidebarTab() {
  const inject = () => {
    // Settings are registered in `ready`; the sidebar may render before then.
    if (!game.settings.has?.(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB)) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB)) return;
    injectSidebarTabNav();
  };

  // Foundry v14 sometimes renders the sidebar before settings are registered, and
  // the setting default is only guaranteed after the client setting store is ready.
  Hooks.on('renderSidebar', inject);
  Hooks.on('setup', inject);
  Hooks.on('ready', () => {
    inject();
    // Re-inject after a tick in case the sidebar renders late.
    setTimeout(inject, 50);
  });

  if (ui.sidebar?.rendered) inject();
}

function injectSidebarTabNav() {
  const tabBar = document.querySelector('#sidebar-tabs');
  if (!tabBar) return;

  const menu = tabBar.querySelector('menu.flexcol');
  if (!menu) return;

  const existingId = 'xro-sidebar-tab-btn';
  // Only inject once.
  if (menu.querySelector(`#${existingId}`)) return;

  // Remove any stray <a> fallback that may have been injected previously.
  tabBar.querySelector('a[data-tab="roll-offs"]')?.remove();

  const item = document.createElement('li');
  item.innerHTML = `
    <button type="button"
            id="xro-sidebar-tab-btn"
            class="ui-control plain icon fas fa-dice"
            aria-label="Xandra Roll-Offs"
            data-tooltip="Roll-Offs"></button>
    <div class="notification-pip"></div>
  `;

  const button = item.querySelector('button');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (RollOffWindow.activeWindow) {
      RollOffWindow.close();
    } else {
      RollOffWindow.open();
    }
  });

  // Insert before the collapse/expand item (last li) or before settings.
  const collapseItem = menu.querySelector('button[data-action="toggleState"]')?.closest('li');
  const settingsItem = menu.querySelector('button[data-tab="settings"]')?.closest('li');
  const insertBefore = settingsItem ?? collapseItem;

  if (insertBefore) {
    menu.insertBefore(item, insertBefore);
  } else {
    menu.appendChild(item);
  }
  console.log(`${MODULE_ID} | Roll-Offs sidebar tab nav injected`);
}
