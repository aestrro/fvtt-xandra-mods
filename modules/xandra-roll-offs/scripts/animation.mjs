import { MODULE_ID } from './utils.mjs';
import { getRollKey, getSessionId } from './roll-protocol.mjs';

const DICE_SO_NICE_ID = 'dice-so-nice';
const pending = new Map();
const completed = new Set();
const heldElements = new WeakMap();
let initialized = false;
let currentSession = null;

const changed = () => Hooks.callAll('xandraRollOffs.presentationUpdated');

function begin(data) {
  const key = getRollKey(data, data.userId);
  if (!key || typeof data.sessionId !== 'string' || typeof data.roundKey !== 'string'
    || !data.animationId || completed.has(data.animationId)) return null;
  currentSession ??= data.sessionId;
  const existing = pending.get(key);
  if (existing?.animationId === data.animationId) return existing;
  existing?.resolve();
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  const entry = { ...data, key, promise, resolve, started: false };
  pending.set(key, entry);
  changed();
  return entry;
}

function finish(entry) {
  if (pending.get(entry.key) !== entry) return;
  pending.delete(entry.key);
  completed.add(entry.animationId);
  entry.resolve();
  changed();
}

async function animate(data) {
  const entry = begin(data);
  if (!entry || entry.started) return;
  entry.started = true;
  try {
    const dice = game.dice3d;
    if (!game.modules.get(DICE_SO_NICE_ID)?.active || typeof dice?.showForRoll !== 'function' || dice.isEnabled?.() === false) return;
    const RollClass = foundry.dice?.Roll ?? globalThis.Roll;
    const roll = RollClass.fromData(data.rollData);
    // This module synchronizes the packet. DSN must only animate on this client.
    await dice.showForRoll(roll, game.users.get(data.userId) ?? game.user, false, null, false, null, data.speaker);
  } catch (error) {
    console.warn(`${MODULE_ID} | Dice animation failed; revealing the saved result`, error);
  } finally {
    finish(entry);
  }
}

export function isRollHidden(context, userId) {
  return pending.has(getRollKey(context, userId));
}

/**
 * @param {string | undefined} sessionId
 * @param {number | null} [roundIndex]
 */
export function hasPendingAnimations(sessionId, roundIndex = null) {
  return [...pending.values()].some((entry) => entry.sessionId === sessionId
    && (roundIndex === null || entry.roundKey.split(':')[0] === String(roundIndex)));
}

export function waitForRollAnimation(key) {
  return pending.get(key)?.promise ?? Promise.resolve();
}

function holdChatMessage(message, html) {
  const key = message.flags?.[MODULE_ID]?.rollKey;
  const element = html?.[0] ?? html;
  if (!key || !pending.has(key) || !element?.style) return;
  const existing = heldElements.get(element);
  if (existing?.key === key) return;
  const visibility = existing?.visibility ?? element.style.visibility;
  const hold = { key, visibility };
  heldElements.set(element, hold);
  element.style.visibility = 'hidden';
  void waitForRollAnimation(key).then(() => {
    if (heldElements.get(element) !== hold) return;
    element.style.visibility = visibility;
    heldElements.delete(element);
  });
}

export function initRollAnimations() {
  if (initialized) return;
  initialized = true;
  Hooks.on('xandraRollOffs.rolling', begin);
  Hooks.on('xandraRollOffs.animateRoll', (data) => { void animate(data); });
  Hooks.on('xandraRollOffs.rollAnimationCancelled', (data) => {
    if (!Array.isArray(data.userIds)) return;
    for (const entry of [...pending.values()]) {
      if (entry.sessionId === data.sessionId && entry.roundKey === data.roundKey && data.userIds.includes(entry.userId)
        && (!data.animationId || entry.animationId === data.animationId)) finish(entry);
    }
  });
  Hooks.on('xandraRollOffs.stateUpdated', (state) => {
    const sessionId = getSessionId(state);
    for (const entry of [...pending.values()]) {
      if (!state || !Object.keys(state).length || entry.sessionId !== sessionId) finish(entry);
    }
    if (!state || !Object.keys(state).length || currentSession !== sessionId) completed.clear();
    currentSession = sessionId;
  });
  Hooks.on('renderChatMessageHTML', holdChatMessage);
  Hooks.on('renderChatMessage', holdChatMessage);
}
