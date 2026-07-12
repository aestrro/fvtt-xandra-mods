/**
 * Pure, unit-testable state functions for the xandra-roll-offs Foundry VTT module.
 *
 * This module intentionally avoids any Foundry or game API usage so it can be
 * exercised in a standard JavaScript test runner. All mutation is performed on
 * plain data objects matching the spec in §6 / §7 of the module specification.
 */

/**
 * @typedef {Object} RollResult
 * A single submitted roll inside a round.
 * @property {number} total - The evaluated total of the roll.
 * @property {string} [rollId] - Optional Foundry Roll identifier for audit trails.
 */

/**
 * @typedef {Object} Round
 * A round or tiebreak round in the roll-off.
 * @property {string} label - Human-readable label, e.g. "Round 1" or "Round 1 - Tiebreak".
 * @property {string[]} participants - Ordered list of user IDs expected to roll.
 * @property {string} dieType - Roll formula used for this round (same as the roll-off).
 * @property {Object<string, RollResult>} rolls - Map of userId to their submitted roll.
 * @property {boolean} resolved - Whether this round has been resolved to a winner.
 * @property {Round|null} parent - Parent round for tiebreaks; null for top-level rounds.
 */

/**
 * @typedef {Object} HistoryEntry
 * Record of a fully resolved top-level round.
 * @property {number} round - 1-based top-level round number.
 * @property {string} winner - User ID of the round winner.
 * @property {Object<string, RollResult>} finalRolls - Final rolls that produced the winner.
 */

/**
 * @typedef {Object} ActiveRollOff
 * The full in-progress state of a roll-off.
 * @property {boolean} active - Whether the roll-off is still in progress.
 * @property {string} dieType - Roll formula for the whole roll-off.
 * @property {number} totalRounds - Total number of top-level rounds configured.
 * @property {number} currentRoundIndex - 0-based index of the current top-level round.
 * @property {string[]} participants - Full participant list for the roll-off.
 * @property {Round[]} roundStack - Active/historical round stack; last entry is active.
 * @property {HistoryEntry[]} history - Resolved top-level rounds.
 */

/**
 * @typedef {Object} ResolveRoundResult
 * Result of resolving a round's rolls.
 * @property {"winner"} type - Single winner.
 * @property {string} userId - The winning user ID.
 * @property {string[]} [userIds] - Omitted for winner results.
 */

/**
 * @typedef {Object} ResolveRoundTieResult
 * Result of resolving a round's rolls when tied.
 * @property {"tie"} type - Tie among two or more participants.
 * @property {string[]} userIds - The tied user IDs.
 */

/**
 * Resolves a map of user rolls into either a single winner or a tie.
 *
 * @param {Object<string, RollResult>} rollsMap - Map of userId to roll result.
 * @returns {ResolveRoundResult | ResolveRoundTieResult} Resolution outcome.
 *
 * @example
 * resolveRound({ u1: { total: 14 }, u2: { total: 9 } })
 * // => { type: "winner", userId: "u1" }
 *
 * resolveRound({ u1: { total: 14 }, u2: { total: 14 } })
 * // => { type: "tie", userIds: ["u1", "u2"] }
 */
export function resolveRound(rollsMap) {
  const entries = Object.entries(rollsMap);
  if (entries.length === 0) {
    return { type: "tie", userIds: [] };
  }

  let maxValue = -Infinity;
  for (const [, roll] of entries) {
    if (roll.total > maxValue) {
      maxValue = roll.total;
    }
  }

  const winners = [];
  for (const [userId, roll] of entries) {
    if (roll.total === maxValue) {
      winners.push(userId);
    }
  }

  if (winners.length === 1) {
    return { type: "winner", userId: winners[0] };
  }
  return { type: "tie", userIds: winners };
}

/**
 * Walks up the parent chain from a round to find the root top-level round.
 *
 * @param {Round[]} roundStack - Full round stack for the roll-off.
 * @param {Round} round - The round whose root should be found.
 * @returns {Round|null} The root top-level round, or null if not found in the stack.
 */
export function findRootRound(roundStack, round) {
  if (!round) return null;

  let current = round;
  const seen = new Set();
  while (current.parent) {
    if (seen.has(current)) {
      // Guard against a malformed circular parent reference.
      return null;
    }
    seen.add(current);
    current = current.parent;
  }
  return current;
}

/**
 * Returns the currently active round, which is always the last entry in the stack.
 *
 * @param {Round[]} roundStack - Round stack for the roll-off.
 * @returns {Round|undefined} The active round, or undefined if the stack is empty.
 */
export function findActiveRound(roundStack) {
  if (!roundStack || roundStack.length === 0) return undefined;
  return roundStack[roundStack.length - 1];
}

/**
 * Advances the roll-off after a top-level round has been fully resolved.
 *
 * Mutates `activeRollOff` in place: collapses resolved tiebreaks, increments the
 * round index or marks the roll-off inactive, and pushes a fresh top-level round
 * when more rounds remain.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to mutate.
 * @returns {ActiveRollOff} The same `activeRollOff` object, mutated.
 */
export function advanceToNextRoundOrEnd(activeRollOff) {
  if (!activeRollOff) {
    throw new Error("advanceToNextRoundOrEnd requires an activeRollOff object");
  }

  // Collapse the resolved tiebreak stack, preserving only history entries.
  // Top-level rounds are never retained in the stack after resolution; history
  // already holds the record.
  activeRollOff.roundStack = [];

  if (activeRollOff.currentRoundIndex + 1 >= activeRollOff.totalRounds) {
    activeRollOff.active = false;
  } else {
    activeRollOff.currentRoundIndex += 1;
    pushNewRound(activeRollOff);
  }

  return activeRollOff;
}

/**
 * Creates a new active roll-off state object.
 *
 * @param {Object} config - Configuration for the roll-off.
 * @param {string} config.dieType - Roll formula (e.g. "1d20", "1d100", "2d6").
 * @param {number} config.totalRounds - Number of top-level rounds.
 * @param {string[]} config.participants - Ordered list of participant user IDs.
 * @returns {ActiveRollOff} A fresh, active roll-off state object.
 */
export function startRollOff({ dieType, totalRounds, participants }) {
  if (!dieType || typeof dieType !== "string") {
    throw new Error("startRollOff requires a non-empty dieType string");
  }
  if (!Number.isInteger(totalRounds) || totalRounds < 1) {
    throw new Error("startRollOff requires totalRounds >= 1");
  }
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error("startRollOff requires at least 2 participants");
  }

  const activeRollOff = {
    active: true,
    dieType,
    totalRounds,
    currentRoundIndex: 0,
    participants: [...participants],
    roundStack: [],
    history: [],
  };

  pushNewRound(activeRollOff);
  return activeRollOff;
}

/**
 * Submits a roll for a user in the active round if allowed.
 *
 * Mutates `activeRollOff` in place. Returns `true` if the roll was recorded,
 * `false` if it was rejected (e.g. user is not a participant, has already
 * rolled, or no round is active).
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to mutate.
 * @param {string} userId - The user submitting the roll.
 * @param {RollResult} rollResult - The evaluated roll result to record.
 * @returns {boolean} Whether the roll was accepted.
 */
export function submitRoll(activeRollOff, userId, rollResult) {
  if (!activeRollOff || !activeRollOff.active) {
    return false;
  }

  const activeRound = findActiveRound(activeRollOff.roundStack);
  if (!activeRound) {
    return false;
  }

  if (!activeRound.participants.includes(userId)) {
    return false;
  }

  if (activeRound.rolls[userId]) {
    return false;
  }

  if (!rollResult || typeof rollResult.total !== "number") {
    return false;
  }

  activeRound.rolls[userId] = { total: rollResult.total };
  return true;
}

/**
 * Determines whether a user is allowed to roll in the currently active round.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to inspect.
 * @param {string} userId - The user to check.
 * @returns {boolean} True if the user is in the active round and has not yet rolled.
 */
export function canUserRoll(activeRollOff, userId) {
  if (!activeRollOff || !activeRollOff.active) {
    return false;
  }

  const activeRound = findActiveRound(activeRollOff.roundStack);
  if (!activeRound) {
    return false;
  }

  if (!activeRound.participants.includes(userId)) {
    return false;
  }

  return !activeRound.rolls[userId];
}

/**
 * Appends a resolved top-level round to the roll-off history.
 *
 * This is a helper used by the orchestration layer (not exported by default, but
 * kept internal to keep state.js free of side effects such as broadcasts).
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to mutate.
 * @param {Round} round - The resolved top-level round.
 * @param {string} winnerId - The winning user ID.
 */
function appendToHistory(activeRollOff, round, winnerId) {
  activeRollOff.history.push({
    round: activeRollOff.currentRoundIndex + 1,
    winner: winnerId,
    finalRolls: structuredClone ? structuredClone(round.rolls) : { ...round.rolls },
  });
}

/**
 * Pushes a new top-level round onto the round stack.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to mutate.
 */
function pushNewRound(activeRollOff) {
  const roundNumber = activeRollOff.currentRoundIndex + 1;
  const round = {
    label: `Round ${roundNumber}`,
    participants: [...activeRollOff.participants],
    dieType: activeRollOff.dieType,
    rolls: {},
    resolved: false,
    parent: null,
  };
  activeRollOff.roundStack.push(round);
}

/**
 * Creates a new tiebreak round scoped to the tied users.
 *
 * This is a helper for the orchestration layer and is not exported.
 *
 * @param {Round} parentRound - The round that produced the tie.
 * @param {string[]} tiedUserIds - The users who tied for the highest roll.
 * @param {string} dieType - The roll formula to use for the tiebreak.
 * @returns {Round} A new tiebreak round object.
 */
function createTiebreakRound(parentRound, tiedUserIds, dieType) {
  return {
    label: `${parentRound.label} - Tiebreak`,
    participants: [...tiedUserIds],
    dieType,
    rolls: {},
    resolved: false,
    parent: parentRound,
  };
}

/**
 * Orchestrates the roll-off after every participant in the active round has
 * rolled. This function is intended to be called by the GM-side orchestration
 * code (main.js / socket.js) after `submitRoll` has returned true and the round
 * is complete. It is kept in state.js because it only mutates the plain data
 * model and emits no Foundry calls.
 *
 * Mutates `activeRollOff` in place.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to mutate.
 * @returns {{
 *   type: "winner" | "tiebreak",
 *   round?: Round,
 *   winnerId?: string,
 *   tiebreak?: Round
 * }} Outcome of the orchestration step.
 */
export function onAllRolledIn(activeRollOff) {
  if (!activeRollOff || activeRollOff.roundStack.length === 0) {
    return { type: "winner" };
  }

  const top = findActiveRound(activeRollOff.roundStack);
  const result = resolveRound(top.rolls);

  if (result.type === "winner") {
    top.resolved = true;
    const root = findRootRound(activeRollOff.roundStack, top) ?? top;
    appendToHistory(activeRollOff, root, result.userId);
    advanceToNextRoundOrEnd(activeRollOff);
    return { type: "winner", round: root, winnerId: result.userId };
  }

  const tiebreak = createTiebreakRound(top, result.userIds, activeRollOff.dieType);
  activeRollOff.roundStack.push(tiebreak);
  return { type: "tiebreak", tiebreak };
}

/**
 * Returns the set of user IDs who are still expected to roll in the active round.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to inspect.
 * @returns {string[]} User IDs who have not yet rolled in the active round.
 */
export function getPendingRollers(activeRollOff) {
  const activeRound = findActiveRound(activeRollOff?.roundStack);
  if (!activeRound) return [];
  return activeRound.participants.filter((userId) => !activeRound.rolls[userId]);
}

/**
 * Checks whether every expected participant in the active round has rolled.
 *
 * @param {ActiveRollOff} activeRollOff - The roll-off state to inspect.
 * @returns {boolean} True if all participants have submitted a roll.
 */
export function isRoundComplete(activeRollOff) {
  return getPendingRollers(activeRollOff).length === 0;
}
