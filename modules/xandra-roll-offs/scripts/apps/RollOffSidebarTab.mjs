import { getActiveRollOff, getWinTallies, SETTINGS } from '../settings.mjs';
import { canUserRoll, findActiveRound } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

const { AbstractSidebarTab } = foundry.applications.sidebar;

/**
 * Sidebar tab that sits between Chat and Combat for Xandra Roll-Offs.
 *
 * Extends Foundry v14's AbstractSidebarTab (ApplicationV2) so the tab renders
 * inside the sidebar like a first-class panel.
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

    let participantStatuses = [];
    let leaderboard = [];
    let canCurrentUserRoll = false;

    if (isActive && activeRound) {
      participantStatuses = (activeRound.participants ?? []).map((userId) => ({
        id: userId,
        name: game.users.get(userId)?.name ?? userId,
        rolled: !!activeRound.rolls[userId],
        value: activeRound.rolls[userId]?.total ?? null,
      }));
      canCurrentUserRoll = canUserRoll(activeRollOff, game.userId);
      leaderboard = Object.entries(tallies)
        .map(([userId, score]) => ({
          name: game.users.get(userId)?.name ?? userId,
          score,
        }))
        .sort((a, b) => b.score - a.score);
    }

    return {
      isActive,
      isGM: game.user.isGM,
      roundLabel: activeRound?.label ?? '',
      dieType: activeRollOff?.dieType ?? '',
      participantStatuses,
      leaderboard,
      canCurrentUserRoll,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;
    html.querySelector('[data-action="roll-off-roll"]')?.addEventListener('click', () => this._onRoll());
    html.querySelector('[data-action="open-gm-panel"]')?.addEventListener('click', () => this._onOpenGMPanel());
  }

  async _onRoll() {
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.requestRoll(game.userId);
  }

  _onOpenGMPanel() {
    game.xandraRollOffs?.openGMPanel?.();
  }
}

/**
 * Register the Roll-Offs sidebar tab between "chat" and "combat".
 *
 * In Foundry v14 the sidebar is an ApplicationV2 instance. Its tab classes are
 * defined on the static Sidebar.TABS mapping. We add our tab there and also
 * attach an instance to the already-rendered sidebar so the tab can be activated
 * immediately.
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

  // After the sidebar is rendered, inject our tab nav button and make sure
  // the tab instance is registered in the sidebar's tab map.
  Hooks.on('renderSidebar', inject);

  // The sidebar may already be rendered by the time modules reach ready.
  if (ui.sidebar?.rendered) inject();

  // Re-render our sidebar tab whenever the roll-off state changes.
  Hooks.on('xandraRollOffs.stateUpdated', () => {
    const tab = ui.sidebar?.tabs?.['roll-offs'];
    if (tab?.rendered) tab.render();
  });
}

/**
 * Ensure the Roll-Offs tab instance is attached to the sidebar tab map.
 *
 * The Sidebar constructor should already have created the tab from Sidebar.TABS,
 * but if the tab was registered after the sidebar was built, instantiate it now.
 */
function registerTabInstance() {
  if (!ui.sidebar?.tabs) return;
  if (!ui.sidebar.tabs['roll-offs']) {
    const tab = new RollOffSidebarTab();
    ui.sidebar.tabs['roll-offs'] = tab;
    console.log(`${MODULE_ID} | Roll-Offs sidebar tab instance attached`);
  }
}

/**
 * Inject a Roll-Offs tab button into the sidebar tab navigation bar
 * immediately after the Chat tab and before the Combat tab.
 */
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
