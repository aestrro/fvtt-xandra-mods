import { getActiveRollOff, getWinTallies, getRollOffHistory, SETTINGS } from '../settings.mjs';
import { canUserRoll, findActiveRound, isRoundComplete, resolveRound } from '../state.mjs';
import { MODULE_ID, getUserActor } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function getUserName(userId) {
  const user = game.users.get(userId);
  if (user?.isGM) return user.name;
  const actor = getUserActor(userId);
  return actor?.name ?? user?.name ?? userId;
}

/**
 * Dedicated roll-off theatre window for all participants.
 *
 * Shows current round status, a scrollable history of resolved rounds, a live
 * win tracker, and a minimal GM control surface for starting / managing roll-offs.
 */
export class RollOffWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;
  static #hookId = null;

  #selectedParticipants = null;
  #showHistory = false;

  static DEFAULT_OPTIONS = {
    id: 'xandra-roll-offs-window',
    classes: ['xandra-roll-offs-window'],
    tag: 'div',
    window: {
      title: 'Roll-Off',
      resizable: true,
      controls: [
        {
          icon: 'fas fa-clock-rotate-left',
          label: 'History',
          action: 'toggleHistory',
          tooltip: 'View session history',
        },
      ],
    },
    position: {
      width: 420,
      height: 560,
    },
    actions: {
      startRollOff: RollOffWindow.startRollOff,
      cancelRollOff: RollOffWindow.cancelRollOff,
      closeRollOff: RollOffWindow.closeRollOff,
      forceResolve: RollOffWindow.forceResolve,
      advanceRound: RollOffWindow.advanceRound,
      rollForParticipant: RollOffWindow.rollForParticipant,
      toggleHistory: RollOffWindow.toggleHistory,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/xandra-roll-offs/templates/roll-off-window.hbs',
    },
  };

  /**
   * Open (or bring to front) the roll-off window as a singleton.
   */
  static open(options = {}) {
    if (!this.#instance) {
      this.#instance = new this();
    }
    return this.#instance.render({ force: true, ...options });
  }

  /**
   * Close the roll-off window if it is open.
   */
  static close() {
    if (this.#instance?.rendered) {
      return this.#instance.close();
    }
  }

  /**
   * Whether the roll-off window is currently rendered.
   * @returns {boolean}
   */
  static get activeWindow() {
    return this.#instance?.rendered ?? false;
  }

  static onStateChanged() {
    const activeRollOff = getActiveRollOff();
    const exists = activeRollOff && Object.keys(activeRollOff).length > 0;
    if (exists) {
      this.open();
    } else {
      this.close();
    }
  }

  constructor(options = {}) {
    super(options);
    this.#selectedParticipants = null;
    if (!this.constructor.#hookId) {
      this.constructor.#hookId = Hooks.on('xandraRollOffs.stateUpdated', () => {
        this.constructor.onStateChanged();
      });
    }
  }

  async close(options = {}) {
    this.constructor.#instance = null;
    return super.close(options);
  }

  async _prepareContext() {
    const activeRollOff = getActiveRollOff();
    const tallies = getWinTallies();
    const sessionHistory = getRollOffHistory();
    const isActive = activeRollOff?.active ?? false;
    const activeRound = isActive ? findActiveRound(activeRollOff.roundStack) : undefined;
    const hasData = activeRollOff && Object.keys(activeRollOff).length > 0;

    let participantStatuses = [];
    let roundHistory = [];
    let canCurrentUserRoll = false;
    let winsNeeded = 0;
    let winner = null;
    let pendingRollers = [];
    let tracker = [];
    let roundComplete = false;
    let roundResult = null;
    let isParticipant = false;

    if (hasData) {
      winsNeeded = activeRollOff.winsNeeded;
      const currentRound = activeRound;
      isParticipant = activeRollOff.participants?.includes(game.userId) ?? false;

      roundComplete = isActive && currentRound ? isRoundComplete(activeRollOff) : false;
      if (roundComplete) {
        const result = resolveRound(currentRound.rolls);
        if (result.type === 'winner') {
          const id = result.userId;
          roundResult = {
            type: 'winner',
            userId: id,
            name: getUserName(id),
          };
        } else {
          roundResult = {
            type: 'tie',
            userIds: result.userIds,
            names: result.userIds.map((id) => getUserName(id)),
            tieNames: result.userIds.map((id) => getUserName(id)).join(', '),
          };
        }
      }

      tracker = (activeRollOff.participants ?? []).map((userId) => {
        const name = getUserName(userId);
        const historyWins = activeRollOff.history?.filter((h) => h.winner === userId).length ?? 0;
        const provisionalWin = roundResult?.type === 'winner' && roundResult?.userId === userId ? 1 : 0;
        const wins = historyWins + provisionalWin;
        const slots = [];
        for (let i = 0; i < winsNeeded; i++) {
          slots.push({ won: i < wins });
        }
        return { userId, name, slots, wins, isCurrentUser: userId === game.userId };
      });

      roundHistory = (activeRollOff.history ?? []).map((entry) => ({
        round: entry.round,
        label: game.i18n.format('XANDRA_ROLL_OFFS.Labels.Round', { round: entry.round }),
        winnerName: getUserName(entry.winner),
        winnerValue: entry.finalRolls[entry.winner]?.total ?? null,
        rolls: Object.entries(entry.finalRolls)
          .map(([userId, roll]) => {
            return {
              name: getUserName(userId),
              value: roll.total,
              userId,
              avatar: getUserActor(userId)?.img ?? game.users.get(userId)?.avatar ?? '',
              isWinner: userId === entry.winner,
            };
          })
          .sort((a, b) => b.value - a.value),
      }));

      for (const entry of activeRollOff.history ?? []) {
        for (const [tieIndex, tieRound] of (entry.tieRounds ?? []).entries()) {
          roundHistory.push({
            round: `tie-${entry.round}-${tieIndex + 1}`,
            label: `Tie #${tieIndex + 1}`,
            tieRound: true,
            winnerName: getUserName(tieRound.winner),
            winnerValue: tieRound.finalRolls?.[tieRound.winner]?.total ?? null,
            rolls: Object.entries(tieRound.finalRolls ?? {})
              .map(([userId, roll]) => ({
                name: getUserName(userId),
                value: roll.total,
                userId,
                avatar: getUserActor(userId)?.img ?? game.users.get(userId)?.avatar ?? '',
                isWinner: userId === tieRound.winner,
              }))
              .sort((a, b) => b.value - a.value),
          });
        }
      }


      if (isActive && currentRound) {
        participantStatuses = (currentRound.participants ?? [])
          .map((userId) => {
            return {
              id: userId,
              name: getUserName(userId),
              rolled: !!currentRound.rolls[userId],
              value: currentRound.rolls[userId]?.total ?? null,
              avatar: getUserActor(userId)?.img ?? game.users.get(userId)?.avatar ?? '',
            };
          })
          .sort((a, b) => {
            if (a.value === null && b.value === null) return 0;
            if (a.value === null) return 1;
            if (b.value === null) return -1;
            return b.value - a.value;
          });
        canCurrentUserRoll = canUserRoll(activeRollOff, game.userId);

        pendingRollers = participantStatuses
          .filter((p) => !p.rolled)
          .map((p) => ({ id: p.id, name: p.name }));
      } else if (!isActive && roundHistory.length > 0) {
        const lastRound = activeRollOff.history.at(-1);
        if (lastRound) {
          winner = {
            id: lastRound.winner,
            name: getUserName(lastRound.winner),
            score: tallies[lastRound.winner] || 0,
          };
        }
      }
    }

    const defaultDieType = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_DIE_TYPE);
    const defaultWinsNeeded = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_WINS_NEEDED);
    const includeGM = game.settings.get(MODULE_ID, SETTINGS.INCLUDE_GM_BY_DEFAULT);
    const users = game.users.map((u) => {
      const isChecked = this.#selectedParticipants !== null
        ? this.#selectedParticipants.has(u.id)
        : includeGM || !u.isGM;
      return {
        id: u.id,
        name: getUserName(u.id),
        isGM: u.isGM,
        checked: isChecked,
        connected: u.active,
        avatar: getUserActor(u.id)?.img ?? u.avatar ?? '',
      };
    });

    const dieChoices = [
      { value: '1d4', label: 'd4' },
      { value: '1d6', label: 'd6' },
      { value: '1d8', label: 'd8' },
      { value: '1d10', label: 'd10' },
      { value: '1d12', label: 'd12' },
      { value: '1d20', label: 'd20' },
      { value: '1d100', label: 'd100' },
    ].map((choice) => ({
      ...choice,
      selected: choice.value === defaultDieType ? 'selected' : '',
    }));

    return {
      hasData,
      showHistory: this.#showHistory,
      sessionHistory: sessionHistory.map((session) => ({
        ...session,
        startedLabel: new Date(session.startedAt).toLocaleString(),
        endedLabel: new Date(session.endedAt).toLocaleString(),
        history: (session.history ?? []).map((round) => ({
          ...round,
          winnerName: getUserName(round.winner),
          winnerValue: round.finalRolls?.[round.winner]?.total ?? null,
          isTie: String(round.round).startsWith('tie-') || round.tieRound === true,
        })),
        winnerName: getUserName(session.winner),
      })).reverse(),
      isActive,
      roundLabel: activeRound?.label ?? '',
      winsNeeded,
      participantStatuses,
      roundHistory,
      canCurrentUserRoll,
      isGM: game.user.isGM,
      isParticipant,
      roundComplete,
      roundResult,
      winner,
      tracker,
      pendingRollers,
      dieChoices,
      defaultWinsNeeded,
      users,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;

    html.querySelector('[data-action="roll-off-roll"]')?.addEventListener('click', () => this._onRoll());
    html.querySelector('[data-action="roll-off-close"]')?.addEventListener('click', () => this.close());
    html.querySelector('select[name="dieType"]')?.addEventListener('change', () => this._updateStartState());
    html.querySelector('input[name="winsNeeded"]')?.addEventListener('input', () => this._updateStartState());

    html.querySelectorAll('.xro-round-scroller').forEach((scroller) => {
      const row = scroller.querySelector('.xro-round-row');
      if (!row) return;

      const updateArrows = () => {
        const maxScroll = row.scrollWidth - row.clientWidth;
        scroller.classList.toggle('xro-round-scroller--scrollable', maxScroll > 1);
        scroller.querySelector('[data-row-scroll="left"]')?.toggleAttribute('disabled', row.scrollLeft <= 1);
        scroller.querySelector('[data-row-scroll="right"]')?.toggleAttribute('disabled', row.scrollLeft >= maxScroll - 1);
      };

      scroller.querySelector('[data-row-scroll="left"]')?.addEventListener('click', () => {
        row.scrollBy({ left: -Math.max(row.clientWidth * 0.72, 120), behavior: 'smooth' });
      });
      scroller.querySelector('[data-row-scroll="right"]')?.addEventListener('click', () => {
        row.scrollBy({ left: Math.max(row.clientWidth * 0.72, 120), behavior: 'smooth' });
      });
      row.addEventListener('scroll', updateArrows, { passive: true });
      updateArrows();
    });

    html.querySelectorAll('[data-action="rollForParticipant"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        console.log(`${MODULE_ID} | GM roll-for-tile clicked`, btn.dataset.userId);
        RollOffWindow.rollForParticipant(event, btn);
      });
    });

    const rows = html.querySelectorAll('.xro-gm-user-row');
    const updateSelection = () => {
      this.#selectedParticipants = new Set(
        Array.from(rows)
          .filter((row) => row.dataset.selected === 'true')
          .map((row) => row.dataset.userId)
      );
    };
    for (const row of rows) {
      const toggleParticipant = () => {
        const selected = row.dataset.selected === 'true';
        row.dataset.selected = selected ? 'false' : 'true';
        row.setAttribute('aria-pressed', selected ? 'false' : 'true');
        row.classList.toggle('xro-gm-user-row--selected', !selected);
        updateSelection();
        this._updateStartState();
      };
      row.addEventListener('click', toggleParticipant);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleParticipant();
        }
      });
    }
    html.querySelectorAll('[data-selection-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const selectAll = button.dataset.selectionAction === 'all';
        rows.forEach((row) => {
          row.dataset.selected = String(selectAll);
          row.setAttribute('aria-pressed', String(selectAll));
          row.classList.toggle('xro-gm-user-row--selected', selectAll);
        });
        updateSelection();
        this._updateStartState();
      });
    });
    this._updateStartState();

    const stack = html.querySelector('.xro-scroll-stack');
    if (stack) {
      stack.scrollTop = stack.scrollHeight;
    }
  }

  _updateStartState() {
    const start = this.element?.querySelector('[data-action="startRollOff"]');
    if (!start) return;
    const selected = this.element.querySelectorAll('.xro-gm-user-row[data-selected="true"]').length;
    const count = this.element.querySelector('[data-selection-count]');
    if (count) count.textContent = `${selected} selected`;
    const die = this.element.querySelector('select[name="dieType"]')?.value ?? '';
    const wins = this.element.querySelector('input[name="winsNeeded"]')?.value ?? '';
    const summary = this.element.querySelector('[data-setup-summary]');
    if (summary) summary.textContent = `${die} · First to ${wins}`;
    start.disabled = selected < 2;
    start.title = selected < 2 ? 'Select at least two participants' : 'Start Roll-Off';
  }

  async _onRoll() {
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.requestRoll(game.userId);
  }

  static async startRollOff(event, target) {
    event.preventDefault();
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.OnlyGmStarts'));
      return;
    }
    const instance = RollOffWindow.#instance;
    const container = target?.closest('.xro-gm-footer')
      ?? event?.currentTarget?.closest?.('.xro-gm-footer')
      ?? RollOffWindow.#instance?.element?.querySelector('.xro-gm-footer');
    if (!container) return;

    const dieType = container.querySelector('select[name="dieType"]')?.value;
    const winsNeeded = Number(container.querySelector('input[name="winsNeeded"]')?.value);
    const stored = instance?.#selectedParticipants;
    const participants = stored !== null && stored.size > 0
      ? [...stored]
      : Array.from(instance?.element?.querySelectorAll('.xro-gm-user-row[data-selected="true"]') ?? []).map((row) => row.dataset.userId);

    if (participants.length < 2) {
      ui.notifications.warn(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants'));
      return;
    }
    const socket = game.modules.get(MODULE_ID).socketHandler;
    if (!socket) {
      console.error(`${MODULE_ID} | startRollOff: socket handler unavailable`);
      ui.notifications.error('Roll-Off controls are still initializing. Try again in a moment.');
      return;
    }
    await socket.startRollOff({ dieType, winsNeeded, participants });
  }

  static async cancelRollOff(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.cancelRollOff();
  }

  static async closeRollOff(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.closeRollOff();
  }

  static async forceResolve(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.forceResolve();
  }

  static async advanceRound(event, target) {
    if (!game.user.isGM) return;
    const socket = game.modules.get(MODULE_ID).socketHandler;
    await socket.advanceRound();
  }

  static async rollForParticipant(event, target) {
    console.log(`${MODULE_ID} | rollForParticipant invoked`, target?.dataset?.userId, target?.outerHTML?.slice(0, 200));
    if (!game.user.isGM) return;
    const btn = target?.closest?.('[data-action="rollForParticipant"]') ?? target;
    const userId = btn?.dataset?.userId;
    if (!userId) {
      console.warn(`${MODULE_ID} | rollForParticipant: no userId`);
      return;
    }
    const activeRollOff = getActiveRollOff();
    if (!activeRollOff?.active) {
      console.warn(`${MODULE_ID} | rollForParticipant: no active roll-off`);
      return;
    }
    if (!canUserRoll(activeRollOff, userId)) {
      ui.notifications.warn('That participant cannot roll right now.');
      console.warn(`${MODULE_ID} | rollForParticipant: user ${userId} cannot roll`);
      return;
    }
    const socket = game.modules.get(MODULE_ID).socketHandler;
    console.log(`${MODULE_ID} | rollForParticipant: requesting roll for ${userId}`);
    await socket.requestRoll(userId);
  }

  static toggleHistory(event) {
    const instance = RollOffWindow.#instance;
    if (!instance) return;
    instance.#showHistory = !instance.#showHistory;
    instance.render({ force: true });
  }
}
