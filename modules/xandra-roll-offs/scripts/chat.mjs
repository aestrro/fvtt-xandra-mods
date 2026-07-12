/**
 * Chat card helpers for the xandra-roll-offs Foundry VTT module.
 *
 * This module is intentionally system-agnostic: it relies only on the Foundry
 * ChatMessage and Roll APIs, never on system-specific actor or sheet data.
 */

/**
 * Returns a ChatMessage speaker object for a user, using their assigned
 * character actor when available.
 *
 * @param {User} user - The Foundry User document.
 * @returns {Object} Speaker data compatible with ChatMessage.create.
 */
export function getSpeakerForUser(user) {
  const actor = user?.character ?? null;
  return ChatMessage.getSpeaker({ actor });
}

/**
 * Posts a single roll-off roll to chat as a standard ROLL type message.
 *
 * @param {User} user - The Foundry User document who rolled.
 * @param {Roll} roll - The evaluated Foundry Roll instance.
 * @param {string} roundLabel - Human-readable round label, e.g. "Round 1".
 * @returns {Promise<ChatMessage>} The created chat message document.
 */
export async function postRollToChat(user, roll, roundLabel) {
  if (!roll) {
    throw new Error("postRollToChat requires a Roll instance");
  }

  const speaker = getSpeakerForUser(user);
  const flavor = user?.name
    ? game.i18n.format("XANDRA_ROLL_OFFS.Chat.RollFlavor", {
        user: user.name,
        round: roundLabel ?? "",
      })
    : game.i18n.format("XANDRA_ROLL_OFFS.Chat.RollFlavorNoUser", {
        round: roundLabel ?? "",
      });

  return ChatMessage.create({
    content: "",
    flavor,
    speaker,
    rolls: [roll],
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    sound: CONFIG.sounds.dice,
  });
}

/**
 * Posts a round or tiebreak resolution summary to chat.
 *
 * @param {Round} round - The resolved round object from state.js.
 * @param {User|null} winnerUser - The winning Foundry User document, or null
 *   if the round is unresolved (e.g. entering a tiebreak).
 * @param {boolean} [isTiebreakNext=false] - Whether a tiebreak follows this round.
 * @param {string[]} [tiedUserIds=[]] - User IDs that tied for highest; used
 *   when isTiebreakNext is true.
 * @returns {Promise<ChatMessage>} The created chat message document.
 */
export async function postRoundSummary(
  round,
  winnerUser,
  isTiebreakNext = false,
  tiedUserIds = []
) {
  if (!round) {
    throw new Error("postRoundSummary requires a round object");
  }

  const rolls = Object.entries(round.rolls).map(([userId, roll]) => ({
    userId,
    name: game.users.get(userId)?.name ?? userId,
    value: roll.total,
  }));

  const winnerName = winnerUser?.name ?? "";
  const tiedNames = isTiebreakNext
    ? tiedUserIds.map((id) => game.users.get(id)?.name ?? id).join(", ")
    : "";

  const content = await renderTemplate(
    "modules/xandra-roll-offs/templates/chat-round-summary.hbs",
    {
      round: round.label,
      rolls,
      winner: !isTiebreakNext && winnerUser,
      winnerName,
      tiedNames,
    }
  );

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user);

  return ChatMessage.create({
    content,
    speaker,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
  });
}

/**
 * Posts the final roll-off summary card to chat.
 *
 * @param {HistoryEntry[]} history - Resolved top-level rounds from the roll-off
 *   state (see state.js).
 * @param {Object<string, number>} tallies - Map of userId to lifetime win count.
 * @returns {Promise<ChatMessage>} The created chat message document.
 */
export async function postRollOffSummary(history, tallies) {
  const rounds = (history ?? []).map((entry) => ({
    round: entry.round,
    winnerName: game.users.get(entry.winner)?.name ?? entry.winner,
  }));

  const talliesList = Object.entries(tallies ?? {})
    .map(([userId, score]) => ({
      name: game.users.get(userId)?.name ?? userId,
      score: Number(score) || 0,
    }))
    .sort((a, b) => b.score - a.score);

  const content = await renderTemplate(
    "modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs",
    {
      rounds,
      tallies: talliesList,
    }
  );

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user);

  return ChatMessage.create({
    content,
    speaker,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
  });
}
