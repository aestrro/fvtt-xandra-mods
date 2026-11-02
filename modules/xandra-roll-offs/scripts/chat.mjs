/**
 * Chat card helpers for the xandra-roll-offs Foundry VTT module.
 *
 * This module is intentionally system-agnostic: it relies only on the Foundry
 * ChatMessage and Roll APIs, never on system-specific actor or sheet data.
 */
import { escapeHTML, getParticipantIdentity, getWorldActor } from './utils.mjs';

/**
 * Returns a ChatMessage speaker object for a user, using their assigned
 * character actor when available.
 *
 * @param {User} user - The Foundry User document.
 * @returns {Object} Speaker data compatible with ChatMessage.create.
 */
export function getSpeakerForUser(user, identities = {}) {
  const identity = getParticipantIdentity(user?.id, identities);
  const actor = getWorldActor(identity.actorId) ?? (user?.isGM ? null : user?.character ?? null);
  return { ...ChatMessage.getSpeaker({ actor }), alias: identity.name };
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
    sound: CONFIG.sounds.dice,
  });
}

export async function postRollOffStarted(round, winsNeeded, participants, dieType, identities = {}) {
  if (!round) return;

  const participantNames = participants.map((id) => escapeHTML(getParticipantIdentity(id, identities).name)).join(', ');
  const content = game.i18n.format('XANDRA_ROLL_OFFS.Chat.RollOffStartedBody', {
    round: round.label,
    winsNeeded,
    participants: participantNames,
    die: dieType,
  });

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user, identities);

  return ChatMessage.create({
    content,
    speaker,
    flavor: game.i18n.localize('XANDRA_ROLL_OFFS.Chat.RollOffStarted'),
  });
}

export async function postRoundStarted(round, participants, dieType, identities = {}) {
  if (!round) return;

  const isTiebreak = Boolean(round.parent);
  const participantNames = participants.map((id) => escapeHTML(getParticipantIdentity(id, identities).name)).join(', ');
  const title = isTiebreak
    ? `Tie-Break #${round.tiebreakIndex ?? 1} Started`
    : `${round.label} Started`;
  const content = `<div class="xro-chat-round-started">
    <div class="xro-chat-round-started-title"><i class="fas ${isTiebreak ? 'fa-bolt' : 'fa-dice'}"></i><strong>${escapeHTML(title)}</strong></div>
    <div class="xro-chat-round-started-meta">${escapeHTML(dieType)} · ${isTiebreak ? 'Tied participants roll again' : 'First to the required wins'}</div>
    <div class="xro-chat-round-started-participants">${participantNames}</div>
  </div>`;

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user, identities);

  return ChatMessage.create({
    content,
    speaker,
    flavor: game.i18n.localize('XANDRA_ROLL_OFFS.Chat.RoundStarted'),
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
  const isWinner = Boolean(!isTiebreakNext && winnerUser);
  const resultText = isWinner
    ? game.i18n.format("XANDRA_ROLL_OFFS.Chat.RoundWinner", { name: winnerName })
    : `${game.i18n.localize("XANDRA_ROLL_OFFS.Chat.RoundTie")} ${tiedNames}`;

  const content = await foundry.applications.handlebars.renderTemplate(
    "modules/xandra-roll-offs/templates/chat-round-summary.hbs",
    {
      round: round.label,
      rolls,
      isWinner,
      winnerName,
      tiedNames,
      resultText,
    }
  );

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user);

  return ChatMessage.create({
    content,
    speaker,
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
export async function postRollOffSummary(history, tallies, winner, identities = {}) {
  const ordinal = (value) => {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
  };
  const rounds = (history ?? []).map((entry) => ({
    round: entry.round,
    winnerName: getParticipantIdentity(entry.winner, identities).name,
  }));

  const talliesList = Object.entries(tallies ?? {})
    .map(([userId, score]) => ({
      name: getParticipantIdentity(userId, identities).name,
      score: Number(score) || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, place: ordinal(index + 1) }));

  const winnerName = winner?.id ? getParticipantIdentity(winner.id, identities).name : winner?.name ?? (talliesList[0]?.name ?? '');
  const winnerScore = winner?.id
    ? Number(tallies?.[winner.id]) || 0
    : talliesList.find((entry) => entry.name === winnerName)?.score ?? 0;

  const content = await foundry.applications.handlebars.renderTemplate(
    "modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs",
    {
      rounds,
      tallies: talliesList,
      winner: winnerName,
      winnerScore,
    }
  );

  const speaker = getSpeakerForUser(game.users.activeGM ?? game.user, identities);

  return ChatMessage.create({
    content,
    speaker,
  });
}
