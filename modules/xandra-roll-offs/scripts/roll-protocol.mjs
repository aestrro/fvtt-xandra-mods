/** Stable identities for transport and chat. No Foundry APIs or localized labels. */
export const REQUEST_TIMEOUT_MS = 10000;
export const SOCKET_NAMESPACE = 'module.xandra-roll-offs';

export function getSessionId(state) {
  return state?.sessionId ?? state?.startedAt ?? 'legacy-session';
}

export function getRoundContext(state) {
  if (!state?.active || !state.roundStack?.length) return null;
  const round = state.roundStack.at(-1);
  return {
    sessionId: getSessionId(state),
    roundKey: `${state.currentRoundIndex ?? 0}:${round.tiebreakIndex ?? 0}`,
  };
}

export function sameRound(a, b) {
  return Boolean(a && b && a.sessionId === b.sessionId && a.roundKey === b.roundKey);
}

export function getRollKey(context, userId) {
  return context && typeof userId === 'string'
    ? JSON.stringify([context.sessionId, context.roundKey, userId])
    : null;
}
