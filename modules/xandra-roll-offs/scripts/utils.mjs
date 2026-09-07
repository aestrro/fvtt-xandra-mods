export const MODULE_ID = 'xandra-roll-offs';

export function log(message) {
  console.log(`Xandra Roll-Offs | ${message}`);
}

export function localize(key, data = {}) {
  return game.i18n.format(key, data);
}

export function getUserName(userId) {
  const user = game.users.get(userId);
  return user?.name ?? userId;
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
  for (const actor of game.actors) {
    if (actor.testUserPermission(user, 'OWNER')) {
      return actor;
    }
  }
  return null;
}
