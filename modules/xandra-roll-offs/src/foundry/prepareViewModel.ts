import { getActiveRollOff, getRollOffHistory, getWinTallies, SETTINGS } from '../../scripts/settings.mjs';
import { canUserRoll, findActiveRound, flattenRoundHistory, isRoundComplete, resolveRound } from '../../scripts/state.mjs';
import { getUserActor, MODULE_ID } from '../../scripts/utils.mjs';

export interface RollDisplay {
  userId: string;
  name: string;
  avatar: string;
  value: number | null;
  rolled?: boolean;
  isWinner?: boolean;
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
  isActive: boolean;
  isGM: boolean;
  isParticipant: boolean;
  canCurrentUserRoll: boolean;
  roundComplete: boolean;
  roundLabel: string;
  roundResult: { type: 'winner' | 'tie'; name?: string; tieNames?: string } | null;
  roundHistory: HistoryRound[];
  participantStatuses: ParticipantStatus[];
  tracker: TrackerParticipant[];
  sessionHistory: SessionHistoryEntry[];
  winner: { id: string; name: string; score: number } | null;
  winsNeeded: number;
  dieChoices: { value: string; label: string }[];
  defaultDieType: string;
  defaultWinsNeeded: number;
  users: { id: string; name: string; isGM: boolean; connected: boolean; avatar: string }[];
}

const getUserName = (userId: string): string => {
  const user = game.users.get(userId);
  if (user?.isGM) return user.name;
  return getUserActor(userId)?.name ?? user?.name ?? userId;
};

export const prepareRoundHistory = (history: any[] = []): HistoryRound[] =>
  flattenRoundHistory(history).map((entry: any) => ({
    label: entry.tieRound
      ? `Tie #${entry.tieIndex}`
      : game.i18n.format('XANDRA_ROLL_OFFS.Labels.Round', { round: entry.round }),
    isTie: Boolean(entry.tieRound),
    winnerName: getUserName(entry.winner),
    winnerValue: entry.finalRolls?.[entry.winner]?.total ?? null,
    rolls: Object.entries(entry.finalRolls ?? {})
      .map(([userId, roll]) => ({
        name: getUserName(userId),
        value: (roll as { total: number }).total,
        userId,
        avatar: getUserActor(userId)?.img ?? game.users.get(userId)?.avatar ?? '',
        isWinner: userId === entry.winner
      }))
      .sort((a, b) => b.value - a.value)
  }));

export const prepareViewModel = (): RollOffViewModel => {
  const activeRollOff = getActiveRollOff() as any;
  const tallies = getWinTallies() as Record<string, number>;
  const isActive = activeRollOff?.active ?? false;
  const activeRound = isActive ? findActiveRound(activeRollOff.roundStack) : undefined;
  const hasData = Boolean(activeRollOff && Object.keys(activeRollOff).length > 0);
  let participantStatuses: ParticipantStatus[] = [];
  let roundHistory: HistoryRound[] = [];
  let canCurrentUserRoll = false;
  let winner: RollOffViewModel['winner'] = null;
  let tracker: TrackerParticipant[] = [];
  let roundComplete = false;
  let roundResult: RollOffViewModel['roundResult'] = null;
  let provisionalWinnerId: string | null = null;
  let isParticipant = false;
  let winsNeeded = 0;

  if (hasData) {
    winsNeeded = activeRollOff.winsNeeded;
    isParticipant = activeRollOff.participants?.includes(game.userId) ?? false;
    roundComplete = Boolean(isActive && activeRound && isRoundComplete(activeRollOff));
    if (roundComplete) {
      const result = resolveRound(activeRound!.rolls);
      if (result.type === 'winner') {
        provisionalWinnerId = result.userId;
        roundResult = { type: 'winner', name: getUserName(result.userId) };
      } else {
        roundResult = {
          type: 'tie',
          tieNames: result.userIds.map((id: string) => getUserName(id)).join(', ')
        };
      }
    }
    tracker = (activeRollOff.participants ?? []).map((userId: string) => {
      const wins = (activeRollOff.history?.filter((h: any) => h.winner === userId).length ?? 0)
        + (provisionalWinnerId === userId ? 1 : 0);
      return {
        userId,
        name: getUserName(userId),
        slots: Array.from({ length: winsNeeded }, (_, index) => ({ won: index < wins })),
        wins,
        isCurrentUser: userId === game.userId
      };
    });
    roundHistory = prepareRoundHistory(activeRollOff.history ?? []);
    if (isActive && activeRound) {
      participantStatuses = (activeRound.participants ?? []).map((userId: string) => ({
        id: userId,
        userId,
        name: getUserName(userId),
        rolled: Boolean(activeRound.rolls[userId]),
        value: activeRound.rolls[userId]?.total ?? null,
        avatar: getUserActor(userId)?.img ?? game.users.get(userId)?.avatar ?? ''
      })).sort((a: ParticipantStatus, b: ParticipantStatus) => {
        if (a.value === null && b.value === null) return 0;
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return b.value - a.value;
      });
      canCurrentUserRoll = canUserRoll(activeRollOff, game.userId);
    } else if (!isActive && roundHistory.length > 0) {
      const lastRound = activeRollOff.history.at(-1);
      if (lastRound) winner = {
        id: lastRound.winner,
        name: getUserName(lastRound.winner),
        score: tallies[lastRound.winner] || 0
      };
    }
  }

  const defaultDieType = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_DIE_TYPE);
  return {
    hasData, isActive, isGM: game.user.isGM, isParticipant, canCurrentUserRoll,
    roundComplete, roundLabel: activeRound?.label ?? '', roundResult,
    roundHistory, participantStatuses, tracker, winner, winsNeeded,
    sessionHistory: getRollOffHistory().map((session: any) => ({
      ...session,
      startedLabel: new Date(session.startedAt).toLocaleString(),
      endedLabel: new Date(session.endedAt).toLocaleString(),
      history: prepareRoundHistory(session.history),
      winnerName: getUserName(session.winner)
    })).reverse(),
    defaultDieType,
    defaultWinsNeeded: game.settings.get(MODULE_ID, SETTINGS.DEFAULT_WINS_NEEDED),
    dieChoices: ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100']
      .map((value) => ({ value, label: value.replace(/^1/, '') })),
    users: game.users.map((user: any) => ({
      id: user.id,
      name: getUserName(user.id),
      isGM: user.isGM,
      connected: user.active,
      avatar: getUserActor(user.id)?.img ?? user.avatar ?? 'icons/svg/mystery-man.svg'
    }))
  };
};
