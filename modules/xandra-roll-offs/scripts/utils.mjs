export const MODULE_ID = 'xandra-roll-offs';

export function escapeHTML(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

export function log(message) {
  console.log(`Xandra Roll-Offs | ${message}`);
}

export function localize(key, data = {}) {
  return game.i18n.format(key, data);
}

export function parseRollCommand(messageText) {
  const match = messageText.trim().match(/^\/(?:roll|r)\s+(\S.*)$/i);
  return match?.[1]?.trim() || null;
}

export function getUserName(userId) {
  const user = game.users.get(userId);
  return user?.name ?? userId;
}

/** Resolve a participant's public display identity, preferring a frozen session snapshot. */
export function getParticipantIdentity(userId, identities = {}) {
  const snapshot = identities?.[userId];
  if (snapshot?.name) return { ...snapshot };
  const user = game.users.get(userId);
  const actor = user?.isGM ? null : getUserActor(userId);
  return {
    actorId: user?.isGM ? '' : user?.character?.id ?? '',
    name: actor?.name ?? user?.name ?? userId ?? '',
    avatar: actor?.img ?? user?.avatar ?? '',
  };
}

export function getWorldActor(actorId) {
  if (!actorId) return null;
  return game.actors?.get?.(actorId) ?? game.actors?.find?.((actor) => actor.id === actorId) ?? null;
}

/** Only the authority uses actor IDs to build snapshots. Clients never supply display text. */
export function snapshotParticipantIdentities(participants, gmIdentities = {}) {
  return Object.fromEntries(participants.map((userId) => {
    const user = game.users.get(userId);
    const actor = user?.isGM ? getWorldActor(gmIdentities[userId]?.actorId) : null;
    const identity = actor
      ? { actorId: actor.id, name: actor.name, avatar: actor.img ?? '' }
      : getParticipantIdentity(userId);
    return [userId, identity];
  }));
}

/**
 * Resolve the best actor to represent a user in the roll-off UI.
 *
 * Prefers the user's assigned default character, then falls back to the first
 * actor they own. Returns `{ name, img }` or `null` if no actor is found.
 */
export function getUserActor(userId) {
  const user = game.users.get(userId);
  if (!user) return null;

  const actor = user.character ?? findFirstOwnedActor(user);
  if (!actor) return null;

  return {
    name: actor.name ?? user.name ?? userId,
    img: actor.img ?? '',
  };
}

function findFirstOwnedActor(user) {
  for (const actor of game.actors?.values?.() ?? game.actors ?? []) {
    if (actor.testUserPermission?.(user, 'OWNER')) {
      return actor;
    }
  }
  return null;
}
