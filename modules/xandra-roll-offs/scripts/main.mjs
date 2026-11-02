import { registerSidebarTab } from './apps/RollOffSidebarTab.mjs';
import { initSocketHandler } from './socket.mjs';
import { registerSettings, getActiveRollOff, SETTINGS } from './settings.mjs';
import { findActiveRound } from './state.mjs';
import { MODULE_ID, log, parseRollCommand } from './utils.mjs';
import { getRoundContext, getRollKey } from './roll-protocol.mjs';

const interceptedCommands = new Map();
let commandSessionId = null;
let RollOffWindow;

export function registerRollOffHooks(windowClass) {
  RollOffWindow = windowClass;
}

/* ================================================================ */
/*  Bootstrap                                                        */
/* ================================================================ */

Hooks.once('init', () => {
  registerSidebarTab(RollOffWindow);
  // Chat-card templates compare only primitive display values.
  Handlebars.registerHelper('eq', (left, right) => left === right);
});

Hooks.once('ready', async () => {
  log('Initializing…');

  registerSettings();

  initSocketHandler();

  // Inject a Roll-Offs button into the chat controls (visible to GM always,
  // and to players whenever a roll-off is active).
  const injectChatButton = () => {
    const chatControls = document.querySelector('#chat-controls');
    if (!chatControls) {
      console.warn(`${MODULE_ID} | Chat controls are not rendered yet`);
      return;
    }

    let button = chatControls.querySelector('.xro-open-gm-panel');
    if (!game.settings.get(MODULE_ID, SETTINGS.SHOW_CHAT_BUTTON)) {
      button?.remove();
      return;
    }

    const activeRollOff = getActiveRollOff();
    const isActive = activeRollOff?.active ?? false;
    const shouldShow = game.user.isGM || isActive;

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
  Hooks.on('xandraRollOffs.chatButtonSettingChanged', injectChatButton);

  // Register a macro-friendly global function for opening the panel
  game.xandraRollOffs = {
    openRollOffWindow: () => RollOffWindow.open(),
  };

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
  Hooks.on('xandraRollOffs.rollOffCancelled', () => RollOffWindow.onStateChanged());

  // Re-render the toolbar so the icon visibility matches the current state.
  Hooks.on('xandraRollOffs.stateUpdated', () => ui.controls?.render?.());

  // Wire /roll interception for active participants
  Hooks.on('chatMessage', (chatLog, messageText, data) => onChatMessage(chatLog, messageText, data));

  // Prevent tagged native copies before creation; cleanup is a last-resort fallback.
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('createChatMessage', (message, options, userId) => onCreateChatMessage(message, options, userId));

  // Entry points and runtime hooks must not depend on optional chat-template preloading.
  try {
    const loadTemplatesFn = foundry.applications.handlebars?.loadTemplates ?? globalThis.loadTemplates;
    if (typeof loadTemplatesFn !== 'function') throw new Error('Template loader unavailable');
    await loadTemplatesFn([
      'modules/xandra-roll-offs/templates/chat-round-summary.hbs',
      'modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs',
    ]);
    log('Templates loaded.');
  } catch (error) {
    console.warn(`${MODULE_ID} | Chat-template preloading failed; panel controls remain available`, error);
  }

  // Restore GM panel visibility, including setup without an active session.
  try {
    await RollOffWindow.restore();
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not restore the panel; use the Roll-Offs button to open it`, error);
  }
  log('Initialization complete.');
});

/* ================================================================ */
/*  /roll Interception                                              */
/* ================================================================ */

function onChatMessage(chatLog, messageText, data = {}) {
  const expression = parseRollCommand(messageText);
  if (!expression) return;

  const activeRollOff = getActiveRollOff();
  if (!activeRollOff?.active) return;
  if (!findActiveRound(activeRollOff.roundStack)?.participants.includes(game.userId)) return;
  if (!matchesDiePattern(expression, activeRollOff.dieType)) {
    ui.notifications.warn(game.i18n.format('XANDRA_ROLL_OFFS.Errors.DiePatternMismatch', { pattern: activeRollOff.dieType }));
    return;
  }

  const socket = game.modules.get(MODULE_ID).socketHandler;
  if (!socket) {
    console.warn(`${MODULE_ID} | Socket handler not ready; /roll ignored`);
    return;
  }

  // Tag only this explicit command's message data. Never match unrelated macros by formula/time.
  const commandId = crypto.randomUUID();
  const context = getRoundContext(activeRollOff);
  if (commandSessionId !== context?.sessionId) {
    interceptedCommands.clear();
    commandSessionId = context?.sessionId;
  }
  const rollKey = getRollKey(context, game.userId);
  data.flags ??= {};
  data.flags[MODULE_ID] = { ...data.flags[MODULE_ID], interceptedRoll: { commandId, rollKey } };
  const request = socket.requestRoll(game.userId);
  interceptedCommands.set(commandId, { rollKey, request });
  request.catch((err) => {
    console.error(`${MODULE_ID} | requestRoll failed for ${game.userId} (${expression})`, err);
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
 * Cleans up a duplicate chat message when a system ignores the synchronous
 * `chatMessage` cancellation. Messages without a matching pending command are
 * left untouched, so unrelated macro and system rolls are never captured.
 */
function onPreCreateChatMessage(message, data, options, userId) {
  if (userId !== game.userId) return;
  const flags = data?.flags?.[MODULE_ID] ?? message.flags?.[MODULE_ID];
  if (flags?.interceptedRoll) return false;
  if (flags?.auditRoll && flags.rollKey && game.messages?.some?.((existing) => existing.flags?.[MODULE_ID]?.rollKey === flags.rollKey)) return false;
}

async function onCreateChatMessage(message, options, userId) {
  // Ignore our own audit roll cards so the GM doesn't re-roll just because they
  // posted a per-roll chat card.
  if (message.flags?.[MODULE_ID]?.auditRoll) return;

  // Only act on messages created by the current user; ignore everyone else's
  // rolls so we don't capture rolls from non-participants or duplicate them.
  const authorId = message.author?.id ?? message.user;
  if (authorId !== game.userId) return;

  const marker = message.flags?.[MODULE_ID]?.interceptedRoll;
  if (!marker) return;
  const capture = interceptedCommands.get(marker.commandId);
  if (!capture || capture.rollKey !== marker.rollKey) return;
  const accepted = await capture.request.catch(() => false);
  // Player requests now have an authoritative acknowledgement too.
  if (accepted !== true) return;

  try {
    if (message.isOwner ?? message.canUser?.(game.user, 'delete')) {
      await message.delete();
    } else {
      console.warn(`${MODULE_ID} | Cannot delete duplicate roll message ${message.id}`);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to delete captured chat message`, err);
  }

}

export { matchesDiePattern, onChatMessage, onPreCreateChatMessage, onCreateChatMessage };
