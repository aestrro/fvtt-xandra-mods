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
    game.xandraRollOffs?.openRollOffWindow?.();
  }
}

/**
 * Register the Roll-Offs sidebar tab between "chat" and "combat".
 */
export function registerSidebarTab() {
  const Sidebar = foundry.applications.sidebar.Sidebar;
  Sidebar.TABS = foundry.utils.mergeObject(Sidebar.TABS, {
    'roll-offs': RollOffSidebarTab,
  });

  const inject = () => {
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB)) return;
    injectSidebarTabNav();
    registerTabInstance();
  };

  Hooks.on('renderSidebar', inject);

  if (ui.sidebar?.rendered) inject();

  Hooks.on('xandraRollOffs.stateUpdated', () => {
    const tab = ui.sidebar?.tabs?.['roll-offs'];
    if (tab?.rendered) tab.render();
  });
}

function registerTabInstance() {
  if (!ui.sidebar?.tabs) return;
  if (!ui.sidebar.tabs['roll-offs']) {
    const tab = new RollOffSidebarTab();
    ui.sidebar.tabs['roll-offs'] = tab;
    console.log(`${MODULE_ID} | Roll-Offs sidebar tab instance attached`);
  }
}

function injectSidebarTabNav() {
  const tabBar = document.querySelector('#sidebar-tabs');
  if (!tabBar || tabBar.querySelector('.item[data-tab="roll-offs"]')) return;

  const chatItem = tabBar.querySelector('.item[data-tab="chat"]');
  const combatItem = tabBar.querySelector('.item[data-tab="combat"]');
  const insertBefore = combatItem ?? null;

  const item = document.createElement('a');
  item.className = 'item';
  item.dataset.tab = 'roll-offs';
  item.dataset.tooltip = 'Roll-Offs';
  item.dataset.tooltipDirection = 'UP';
  item.setAttribute('aria-label', 'Roll-Offs');
  item.innerHTML = '<i class="fas fa-dice"></i>';
  item.addEventListener('click', () => ui.sidebar.changeTab('roll-offs', { triggerCallback: true }));

  if (insertBefore) {
    tabBar.insertBefore(item, insertBefore);
  } else if (chatItem) {
    chatItem.after(item);
  } else {
    tabBar.appendChild(item);
  }
}
