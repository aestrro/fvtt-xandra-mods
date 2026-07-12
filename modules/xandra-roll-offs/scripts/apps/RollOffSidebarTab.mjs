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
 * Foundry v14 initializes sidebar tabs from CONFIG.ui.sidebar and stores
 * instances on ui.sidebar.tabs. We inject ourselves into the tab list and
 * instantiate our tab after the core sidebar renders.
 */
export function registerSidebarTab() {
  // Insert the tab configuration between chat and combat.
  const tabs = CONFIG.ui.sidebar?.tabs ?? {};
  const ordered = [];
  for (const [key, value] of Object.entries(tabs)) {
    if (key === 'combat') ordered.push(['roll-offs', RollOffSidebarTab]);
    ordered.push([key, value]);
  }
  if (!ordered.some(([k]) => k === 'roll-offs')) {
    ordered.push(['roll-offs', RollOffSidebarTab]);
  }
  CONFIG.ui.sidebar.tabs = Object.fromEntries(ordered);

  // After the sidebar is rendered, patch the tab navigation to include our
  // tab icon between Chat and Combat.
  Hooks.on('renderSidebar', () => {
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_SIDEBAR_TAB)) return;
    injectSidebarTabNav();
  });

  // Re-render our sidebar tab whenever the roll-off state changes.
  Hooks.on('xandraRollOffs.stateUpdated', () => {
    const tab = ui.sidebar?.tabs?.['roll-offs'];
    if (tab?.rendered) tab.render();
  });
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
