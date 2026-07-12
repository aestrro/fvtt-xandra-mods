import { getActiveRollOff, getWinTallies, SETTINGS } from '../settings.mjs';
import { canUserRoll, findActiveRound } from '../state.mjs';
import { MODULE_ID } from '../utils.mjs';

/**
 * Sidebar tab that sits between Chat and Combat for Xandra Roll-Offs.
 *
 * This intentionally extends SidebarTab rather than ApplicationV2 so Foundry
 * treats it as a first-class sidebar tab. In v14 SidebarTab is still
 * ApplicationV1-based; this keeps compatibility with the existing tab system.
 */
export class RollOffSidebarTab extends SidebarTab {
  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = 'roll-offs';
    options.template = 'modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs';
    options.title = 'XANDRA_ROLL_OFFS.Name';
    options.scrollY = ['.xro-sidebar-content'];
    return options;
  }

  /** @override */
  getData(options = {}) {
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
  activateListeners(html) {
    super.activateListeners(html);
    html.find('[data-action="roll-off-roll"]').click(() => this._onRoll());
    html.find('[data-action="open-gm-panel"]').click(() => this._onOpenGMPanel());
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
 * In Foundry v14 the sidebar is an ApplicationV1 instance with a `tabs` map.
 * We inject a navigation button and attach our tab instance to `ui.sidebar.tabs`
 * so `activateTab('roll-offs')` renders the tab content in the sidebar.
 */
export function registerSidebarTab() {
  // After the sidebar is rendered, inject our tab nav button and make sure
  // the tab instance is registered in the sidebar's tab map.
  Hooks.on('renderSidebar', () => {
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB)) return;
    injectSidebarTabNav();
    registerTabInstance();
  });

  // Re-render our sidebar tab whenever the roll-off state changes.
  Hooks.on('xandraRollOffs.stateUpdated', () => {
    const tab = ui.sidebar?.tabs?.['roll-offs'];
    if (tab?.rendered) tab.render();
  });
}

/**
 * Ensure the Roll-Offs tab instance is attached to the sidebar tab map.
 */
function registerTabInstance() {
  if (!ui.sidebar?.tabs) return;
  if (!ui.sidebar.tabs['roll-offs']) {
    const tab = new RollOffSidebarTab();
    ui.sidebar.tabs['roll-offs'] = tab;
    console.log(`${MODULE_ID} | Roll-Offs sidebar tab registered`);
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
  item.addEventListener('click', () => ui.sidebar.activateTab('roll-offs'));

  if (insertBefore) {
    tabBar.insertBefore(item, insertBefore);
  } else if (chatItem) {
    chatItem.after(item);
  } else {
    tabBar.appendChild(item);
  }
}
