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
