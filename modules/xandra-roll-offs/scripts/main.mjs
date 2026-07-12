import { GMPanelApp } from './apps/GMPanelApp.mjs';
import { PlayerPromptApp } from './apps/PlayerPromptApp.mjs';
import { RollOffWindow } from './apps/RollOffWindow.mjs';
import { registerSidebarTab } from './apps/RollOffSidebarTab.mjs';
import { initSocketHandler } from './socket.mjs';
import { registerSettings, getActiveRollOff } from './settings.mjs';
import { canUserRoll } from './state.mjs';
import { MODULE_ID, log } from './utils.mjs';

/* ================================================================ */
/*  Bootstrap                                                        */
/* ================================================================ */

Hooks.once('init', () => {
  // Register the sidebar tab class early so the Sidebar constructor picks it up.
  registerSidebarTab();
});

Hooks.once('ready', async () => {
  log('Initializing…');

  registerSettings();

  // Pre-load templates so AppV2 parts resolve
  const templates = [
    'modules/xandra-roll-offs/templates/gm-panel.hbs',
    'modules/xandra-roll-offs/templates/player-prompt.hbs',
    'modules/xandra-roll-offs/templates/chat-round-summary.hbs',
    'modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs',
    'modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs',
    'modules/xandra-roll-offs/templates/roll-off-window.hbs',
  ];
  const loadTemplatesFn = foundry.applications.handlebars?.loadTemplates ?? loadTemplates;
  await loadTemplatesFn(templates);
  log('Templates loaded.');

  initSocketHandler();

  // Inject a Roll-Offs button into the chat controls (matches dice-tray pattern)
  const injectChatButton = () => {
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE_ID, 'showChatButton')) return;

    const chatControls = document.querySelector('#chat-controls');
    if (!chatControls || chatControls.querySelector('.xro-open-gm-panel')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xro-open-gm-panel ui-control icon';
    button.setAttribute('aria-label', 'Open Roll-Offs');
    button.setAttribute('data-tooltip', 'Roll-Offs');
    button.setAttribute('data-tooltip-direction', 'UP');
    button.innerHTML = '<i class="fas fa-dice"></i>';
    button.addEventListener('click', () => GMPanelApp.render());

    const controlButtons = chatControls.querySelector('.control-buttons');
    if (controlButtons) {
      controlButtons.after(button);
    } else {
      chatControls.appendChild(button);
    }
  };
  Hooks.on('renderChatLog', injectChatButton);
  injectChatButton(); // Chat log may already be rendered

  // Register a macro-friendly global function for opening the panel
  game.xandraRollOffs = {
    openGMPanel: () => GMPanelApp.render(),
    openRollOffWindow: () => RollOffWindow.open(),
  };

  log('Initialization complete.');

  // Open the roll-off window if one is already active, then keep it in sync
  // with future round starts/tiebreaks/ends.
  if (getActiveRollOff()?.active) {
    RollOffWindow.open();
  }

  Hooks.on('xandraRollOffs.roundStarted', () => {
    RollOffWindow.open();
    if (game.settings.get(MODULE_ID, 'showPlayerPrompt')) {
      PlayerPromptApp.renderIfNeeded();
    }
  });
  Hooks.on('xandraRollOffs.tiebreakStarted', () => {
    RollOffWindow.open();
    if (game.settings.get(MODULE_ID, 'showPlayerPrompt')) {
      PlayerPromptApp.renderIfNeeded();
    }
  });
  Hooks.on('xandraRollOffs.rollOffEnded', () => RollOffWindow.close());
  Hooks.on('xandraRollOffs.rollOffCancelled', () => RollOffWindow.close());

  // Wire /roll interception for active participants
  Hooks.on('chatMessage', (chatLog, messageText, data) => onChatMessage(chatLog, messageText, data));

  // If a prompt should already be open on ready, show it once
  if (game.settings.get(MODULE_ID, 'showPlayerPrompt')) {
    PlayerPromptApp.renderIfNeeded();
  }
});

/* ================================================================ */
/*  /roll Interception                                              */
/* ================================================================ */

async function onChatMessage(chatLog, messageText, data) {
  const text = messageText.trim().toLowerCase();
  if (!text.startsWith('/roll') && !text.startsWith('/r')) return;

  const activeRollOff = getActiveRollOff();
  if (!activeRollOff?.active) return;
  if (!canUserRoll(activeRollOff, game.userId)) return;

  // Extract the die expression after the command
  const match = text.match(/^(?:\/roll|\/r)\s*(\S.*)$/);
  if (!match) return;

  const expression = match[1].trim();
  if (!matchesDiePattern(expression, activeRollOff.dieType)) {
    ui.notifications.warn(game.i18n.format('XANDRA_ROLL_OFFS.Errors.DiePatternMismatch', { pattern: activeRollOff.dieType }));
    return;
  }

  // Send the roll request to the GM authority
  const socket = game.modules.get(MODULE_ID).socketHandler;
  await socket.requestRoll(game.userId);

  // Suppress the default chat message
  return false;
}

function matchesDiePattern(expression, dieType) {
  const a = normalizeDie(expression);
  const b = normalizeDie(dieType);
  return a === b;
}

function normalizeDie(formula) {
  return formula
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/^(\d)d/, '$1d'); // leave leading digit alone
}

export { matchesDiePattern };
