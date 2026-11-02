import {
  getActiveRollOff,
  getRollOffHistory,
  getWinTallies,
  SETTINGS,
} from "../../scripts/settings.mjs";
import {
  canUserRoll,
  findActiveRound,
  flattenRoundHistory,
  isRoundComplete,
  resolveRound,
} from "../../scripts/state.mjs";
import { getParticipantIdentity, MODULE_ID } from "../../scripts/utils.mjs";
import { hasPendingAnimations, isRollHidden } from "../../scripts/animation.mjs";
import { getRoundContext, getSessionId } from "../../scripts/roll-protocol.mjs";

export interface RollDisplay {
  userId: string;
  name: string;
  avatar: string;
  value: number | null;
  rolled?: boolean;
  isWinner?: boolean;
  rolling?: boolean;
}

export interface ParticipantStatus extends RollDisplay {
  id: string;
  rolled: boolean;
}

export interface HistoryRound {
  label: string;
  isTie: boolean;
  winnerName: string;
  winnerValue: number | null;
  rolls: RollDisplay[];
}

export interface TrackerParticipant {
  userId: string;
  name: string;
  wins: number;
  isCurrentUser: boolean;
  slots: { won: boolean }[];
}

export interface SessionHistoryEntry {
  id: string;
  winnerName: string;
  endedAt: string;
  endedLabel: string;
  dieType: string;
  winsNeeded: number;
  participants: string[];
  history: HistoryRound[];
}

export interface RollOffViewModel {
  hasData: boolean;
  sessionId?: string;
  isActive: boolean;
  isGM: boolean;
  isParticipant: boolean;
  canCurrentUserRoll: boolean;
  roundComplete: boolean;
  roundLabel: string;
  roundResult: {
    type: "winner" | "tie";
    name?: string;
    tieNames?: string;
    avatar?: string;
  } | null;
  roundHistory: HistoryRound[];
  participantStatuses: ParticipantStatus[];
  tracker: TrackerParticipant[];
  sessionHistory: SessionHistoryEntry[];
  winner: { id: string; name: string; score: number; avatar: string } | null;
  winsNeeded: number;
  dieChoices: { value: string; label: string }[];
  defaultDieType: string;
  defaultWinsNeeded: number;
  gmActorId?: string;
  gmActorChoices?: { id: string; name: string; avatar: string }[];
  gmDefaultIdentity?: { name: string; avatar: string };
  currentUserId?: string;
  users: {
    id: string;
    name: string;
    isGM: boolean;
    connected: boolean;
    avatar: string;
  }[];
}

const getUserName = (userId: string, identities = {}): string => getParticipantIdentity(userId, identities).name;

export const prepareRoundHistory = (history: any[] = [], identities = {}, sessionId?: string): HistoryRound[] =>
  flattenRoundHistory(history).map((entry: any) => {
    const roundIndex = Number(entry.tieRound ? entry.parentRound : entry.round) - 1;
    const context = { sessionId, roundKey: `${roundIndex}:${entry.tieIndex ?? 0}` };
    const pendingRound = sessionId ? hasPendingAnimations(sessionId, roundIndex) : false;
    return {
    label: entry.tieRound
      ? `Tie #${entry.tieIndex}`
      : game.i18n.format("XANDRA_ROLL_OFFS.Labels.Round", {
          round: entry.round,
        }),
    isTie: Boolean(entry.tieRound),
    winnerName: pendingRound ? '' : getUserName(entry.winner, identities),
    winnerValue: pendingRound ? null : entry.finalRolls?.[entry.winner]?.total ?? null,
    rolls: Object.entries(entry.finalRolls ?? {})
      .map(([userId, roll]) => ({
        name: getUserName(userId, identities),
        value: isRollHidden(context, userId) ? null : (roll as { total: number }).total,
        rolling: isRollHidden(context, userId),
        userId,
        avatar: getParticipantIdentity(userId, identities).avatar,
        isWinner: !pendingRound && userId === entry.winner,
      }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    };
  });

export const prepareViewModel = (): RollOffViewModel => {
  const activeRollOff = getActiveRollOff() as any;
  const sessionId = getSessionId(activeRollOff);
  const context = getRoundContext(activeRollOff);
  const pendingAnimations = hasPendingAnimations(sessionId);
  const identities = activeRollOff?.participantIdentities ?? {};
  const gmIdentities = game.settings.get(MODULE_ID, SETTINGS.GM_IDENTITIES) ?? {};
  const tallies = getWinTallies() as Record<string, number>;
  const isActive = activeRollOff?.active ?? false;
  const activeRound = isActive
    ? findActiveRound(activeRollOff.roundStack)
    : undefined;
  const hasData = Boolean(
    activeRollOff && Object.keys(activeRollOff).length > 0,
  );
  let participantStatuses: ParticipantStatus[] = [];
  let roundHistory: HistoryRound[] = [];
  let canCurrentUserRoll = false;
  let winner: RollOffViewModel["winner"] = null;
  let tracker: TrackerParticipant[] = [];
  let roundComplete = false;
  let roundResult: RollOffViewModel["roundResult"] = null;
  let provisionalWinnerId: string | null = null;
  let isParticipant = false;
  let winsNeeded = 0;

  if (hasData) {
    winsNeeded = activeRollOff.winsNeeded;
    isParticipant = activeRollOff.participants?.includes(game.userId) ?? false;
    roundComplete = Boolean(
      isActive && activeRound && isRoundComplete(activeRollOff) && !pendingAnimations,
    );
    if (roundComplete) {
      const result = resolveRound(activeRound!.rolls);
      if (result.type === "winner") {
        provisionalWinnerId = result.userId;
        roundResult = {
          type: "winner",
          name: getUserName(result.userId, identities),
          avatar: getParticipantIdentity(result.userId, identities).avatar,
        };
      } else {
        roundResult = {
          type: "tie",
          tieNames: result.userIds
            .map((id: string) => getUserName(id, identities))
            .join(", "),
        };
      }
    }
    tracker = (activeRollOff.participants ?? []).map((userId: string) => {
      const wins =
        (activeRollOff.history?.filter((h: any) => h.winner === userId && !hasPendingAnimations(sessionId, h.round - 1))
          .length ?? 0) + (provisionalWinnerId === userId ? 1 : 0);
      return {
        userId,
        name: getUserName(userId, identities),
        slots: Array.from({ length: winsNeeded }, (_, index) => ({
          won: index < wins,
        })),
        wins,
        isCurrentUser: userId === game.userId,
      };
    });
    roundHistory = prepareRoundHistory(activeRollOff.history ?? [], identities, sessionId);
    if (isActive && activeRound) {
      participantStatuses = (activeRound.participants ?? [])
        .map((userId: string) => ({
          id: userId,
          userId,
          name: getUserName(userId, identities),
          rolled: Boolean(activeRound.rolls[userId]) && !isRollHidden(context, userId),
          rolling: isRollHidden(context, userId),
          value: activeRound.rolls[userId] && !isRollHidden(context, userId)
            ? activeRound.rolls[userId].total
            : null,
          avatar: getParticipantIdentity(userId, identities).avatar,
        }))
        .sort((a: ParticipantStatus, b: ParticipantStatus) => {
          if (a.value === null && b.value === null) return 0;
          if (a.value === null) return 1;
          if (b.value === null) return -1;
          return b.value - a.value;
        });
      canCurrentUserRoll = canUserRoll(activeRollOff, game.userId) && !isRollHidden(context, game.userId);
    } else if (!isActive && roundHistory.length > 0 && !pendingAnimations) {
      const lastRound = activeRollOff.history.at(-1);
      if (lastRound)
        winner = {
          id: lastRound.winner,
          name: getUserName(lastRound.winner, identities),
          score: tallies[lastRound.winner] || 0,
          avatar: getParticipantIdentity(lastRound.winner, identities).avatar || "icons/svg/mystery-man.svg",
        };
    }
  }

  const defaultDieType = game.settings.get(
    MODULE_ID,
    SETTINGS.DEFAULT_DIE_TYPE,
  );
  return {
    hasData,
    sessionId,
    isActive,
    isGM: game.user.isGM,
    isParticipant,
    canCurrentUserRoll,
    roundComplete,
    roundLabel: activeRound?.label ?? "",
    roundResult,
    roundHistory,
    participantStatuses,
    tracker,
    winner,
    winsNeeded,
    sessionHistory: getRollOffHistory()
      .map((session: any) => ({
        ...session,
        startedLabel: new Date(session.startedAt).toLocaleString(),
        endedLabel: new Date(session.endedAt).toLocaleString(),
        history: prepareRoundHistory(session.history, session.participantIdentities ?? {}, session.id),
        winnerName: hasPendingAnimations(session.id) ? '' : getUserName(session.winner, session.participantIdentities ?? {}),
      }))
      .reverse(),
    defaultDieType,
    currentUserId: game.userId,
    gmActorId: gmIdentities[game.userId]?.actorId ?? '',
    gmDefaultIdentity: game.user.isGM ? getParticipantIdentity(game.userId) : undefined,
    gmActorChoices: game.user.isGM
      ? Array.from(game.actors?.values?.() ?? game.actors ?? []).map((actor: any) => ({ id: actor.id, name: actor.name, avatar: actor.img ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name))
      : [],
    defaultWinsNeeded: game.settings.get(
      MODULE_ID,
      SETTINGS.DEFAULT_WINS_NEEDED,
    ),
    dieChoices: ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100"].map(
      (value) => ({ value, label: value.replace(/^1/, "") }),
    ),
    users: game.users.map((user: any) => ({
      id: user.id,
      name: getUserName(user.id, hasData ? identities : gmIdentities),
      isGM: user.isGM,
      connected: user.active,
      avatar: getParticipantIdentity(user.id, hasData ? identities : gmIdentities).avatar || "icons/svg/mystery-man.svg",
    })),
  };
};
