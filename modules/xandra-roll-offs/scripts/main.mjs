import { GMPanelApp } from './apps/GMPanelApp.mjs';
import { PlayerPromptApp } from './apps/PlayerPromptApp.mjs';
import { registerSidebarTab } from './apps/RollOffSidebarTab.mjs';
import { initSocketHandler } from './socket.mjs';
import { registerSettings, getActiveRollOff } from './settings.mjs';
import { canUserRoll } from './state.mjs';
import { MODULE_ID, log } from './utils.mjs';

/* ================================================================ */
/*  Bootstrap                                                        */
/* ================================================================ */

Hooks.once('init', async () => {
  log('Initializing…');

  registerSettings();

  // Pre-load templates so AppV2 parts resolve
  const templates = [
    'modules/xandra-roll-offs/templates/gm-panel.hbs',
    'modules/xandra-roll-offs/templates/player-prompt.hbs',
    'modules/xandra-roll-offs/templates/chat-round-summary.hbs',
    'modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs',
    'modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs',
  ];
  await foundry.applications.handlebars.loadTemplates(templates);

  initSocketHandler();
  registerSidebarTab();

  // Inject a Roll-Offs button into the chat controls (matches dice-tray pattern)
  Hooks.on('renderChatLog', (app, html) => {
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
  });

  // Register a macro-friendly global function for opening the panel
  game.xandraRollOffs = {
    openGMPanel: () => GMPanelApp.render(),
  };

  log('Initialization complete.');
});

Hooks.once('ready', () => {
  log('Ready.');

  // Open player prompt for the current user whenever a round/tiebreak starts
  // and they are eligible to roll.
  Hooks.on('xandraRollOffs.roundStarted', () => {
    if (game.settings.get(MODULE_ID, 'showPlayerPrompt')) {
      PlayerPromptApp.renderIfNeeded();
    }
  });
  Hooks.on('xandraRollOffs.tiebreakStarted', () => {
    if (game.settings.get(MODULE_ID, 'showPlayerPrompt')) {
      PlayerPromptApp.renderIfNeeded();
    }
  });

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
