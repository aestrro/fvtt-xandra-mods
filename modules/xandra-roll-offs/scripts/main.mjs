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

  // Small helper for zebra-striping round groups in the roll-off window.
  Handlebars.registerHelper('mod2', (value) => (Number(value) % 2) !== 0);

  // Helper for joining arrays in templates (e.g. tie participant names).
  Handlebars.registerHelper('join', (arr, separator) => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator ?? ', ');
  });
});

Hooks.once('ready', async () => {
  log('Initializing…');

  registerSettings();

  // Pre-load templates so AppV2 parts resolve
  const templates = [
    'modules/xandra-roll-offs/templates/chat-round-summary.hbs',
    'modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs',
    'modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs',
    'modules/xandra-roll-offs/templates/roll-off-window.hbs',
  ];
  const loadTemplatesFn = foundry.applications.handlebars?.loadTemplates ?? loadTemplates;
  await loadTemplatesFn(templates);
  log('Templates loaded.');

  initSocketHandler();

  // Inject a Roll-Offs button into the chat controls (visible to GM always,
  // and to players whenever a roll-off is active).
  const injectChatButton = () => {
    if (!game.settings.get(MODULE_ID, 'showChatButton')) return;

    const activeRollOff = getActiveRollOff();
    const isActive = activeRollOff?.active ?? false;
    const shouldShow = game.user.isGM || isActive;

    const chatControls = document.querySelector('#chat-controls');
    if (!chatControls) return;

    let button = chatControls.querySelector('.xro-open-gm-panel');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'xro-open-gm-panel ui-control icon';
      button.setAttribute('aria-label', 'Open Roll-Offs');
      button.setAttribute('data-tooltip', 'Roll-Offs');
      button.setAttribute('data-tooltip-direction', 'UP');
      button.innerHTML = '<i class="fas fa-dice"></i>';
      button.addEventListener('click', () => RollOffWindow.open());

      const controlButtons = chatControls.querySelector('.control-buttons');
      if (controlButtons) {
        controlButtons.after(button);
      } else {
        chatControls.appendChild(button);
      }
    }

    button.style.display = shouldShow ? '' : 'none';
  };
  Hooks.on('renderChatLog', injectChatButton);
  injectChatButton(); // Chat log may already be rendered
  Hooks.on('xandraRollOffs.stateUpdated', injectChatButton);

  // Register a macro-friendly global function for opening the panel
  game.xandraRollOffs = {
    openRollOffWindow: () => RollOffWindow.open(),
  };

  log('Initialization complete.');

  // Open the roll-off window if one is already active, then keep it in sync
  // with future round starts/tiebreaks/ends.
  const maybeOpen = () => {
    if (getActiveRollOff()?.active) RollOffWindow.open();
  };
  maybeOpen();

  Hooks.on('xandraRollOffs.roundStarted', () => {
    RollOffWindow.open();
  });
  Hooks.on('xandraRollOffs.tiebreakStarted', () => {
    RollOffWindow.open();
  });
  Hooks.on('xandraRollOffs.rollOffEnded', () => {
    // Keep the window open to show the final winner; the GM can use Close Roll-Off.
    RollOffWindow.open();
  });
  Hooks.on('xandraRollOffs.rollOffCancelled', () => RollOffWindow.close());

  // Re-render the toolbar so the icon visibility matches the current state.
  Hooks.on('xandraRollOffs.stateUpdated', () => ui.controls?.render?.());

  // Wire /roll interception for active participants
  Hooks.on('chatMessage', (chatLog, messageText, data) => onChatMessage(chatLog, messageText, data));

  // Catch rolls that bypass the chatMessage hook (e.g., from system-specific
  // command handling or other modules) by inspecting created chat messages.
  Hooks.on('createChatMessage', (message, options, userId) => onCreateChatMessage(message, options, userId));
});

/* ================================================================ */
/*  /roll Interception                                              */
/* ================================================================ */

function onChatMessage(chatLog, messageText, data) {
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

  const socket = game.modules.get(MODULE_ID).socketHandler;
  if (!socket) {
    console.warn(`${MODULE_ID} | Socket handler not ready; /roll ignored`);
    return;
  }

  // Fire the roll-off request without awaiting so the hook can return false
  // synchronously and suppress the default chat message.
  socket.requestRoll(game.userId).catch((err) => {
    console.error(`${MODULE_ID} | requestRoll failed`, err);
  });

  // Suppress the default chat message
  return false;
}

function matchesDiePattern(expression, dieType) {
  const a = normalizeDie(expression);
  const b = normalizeDie(dieType);
  return a === b;
}

function normalizeDie(formula) {
  const clean = formula.toString().replace(/\s+/g, '').toLowerCase();
  // Treat bare "d100" the same as "1d100" for matching purposes.
  if (/^d\d+$/.test(clean)) return `1${clean}`;
  return clean;
}

/* ================================================================ */
/*  createChatMessage fallback                                       */
/* ================================================================ */

/**
 * Catches chat messages that contain a matching roll from the current user
 * while they are an active participant. This handles systems or modules that
 * bypass the synchronous `chatMessage` hook, as well as the `/roll` macro
 * command if it doesn't get intercepted earlier.
 *
 * The chat message is deleted and the roll-off is submitted by the GM via the
 * existing socket request flow (GM-authoritative roll evaluation).
 */
async function onCreateChatMessage(message, options, userId) {
  const activeRollOff = getActiveRollOff();
  if (!activeRollOff?.active) return;

  // Ignore our own audit roll cards so the GM doesn't re-roll just because they
  // posted a per-roll chat card.
  if (message.flags?.[MODULE_ID]?.auditRoll) return;

  // Only act on messages created by the current user; ignore everyone else's
  // rolls so we don't capture rolls from non-participants or duplicate them.
  const authorId = message.author?.id ?? message.user;
  if (authorId !== game.userId) return;

  if (!canUserRoll(activeRollOff, game.userId)) return;

  const rolls = message.rolls ?? [];
  if (rolls.length === 0) return;

  const roll = rolls[0];
  if (!matchesDiePattern(roll.formula, activeRollOff.dieType)) return;

  const socket = game.modules.get(MODULE_ID).socketHandler;
  if (!socket) {
    console.warn(`${MODULE_ID} | Socket handler not ready; createChatMessage fallback ignored`);
    return;
  }

  try {
    if (message.isOwner ?? message.canUser?.(game.user, 'delete')) {
      await message.delete();
    } else {
      console.warn(`${MODULE_ID} | Cannot delete chat message ${message.id}; roll will still be submitted`);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to delete captured chat message`, err);
  }

  await socket.requestRoll(game.userId);
}

export { matchesDiePattern };
