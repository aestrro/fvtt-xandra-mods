import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { RollOffViewModel } from "../../foundry/prepareViewModel";
import RoundTimeline from "../RoundTimeline";
import SessionHistory from "../SessionHistory";
import SetupView from "../SetupView";

export type RollOffAction =
  | "roll"
  | "rollFor"
  | "advance"
  | "forceResolve"
  | "cancel"
  | "closeRollOff"
  | "closeWindow"
  | "start"
  | "setGMIdentity";

interface RollOffAppProps {
  model: RollOffViewModel;
  showHistory: boolean;
  areRollsSettled?: boolean;
  onAction: (action: RollOffAction, payload?: any) => Promise<unknown>;
}

const label = (key: string) => game.i18n.localize(`XANDRA_ROLL_OFFS.${key}`);
const RESULT_MODAL_DELAY_MS = 500;

const WinProgress = ({ wins, target }: { wins: number; target: number }) => (
  <span className="xro-win-progress">
    {game.i18n.format("XANDRA_ROLL_OFFS.Labels.WinProgress", { wins, target })}
  </span>
);

const WinsPopover = ({ model }: { model: RollOffViewModel }) => {
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissEscape, true);
    };
  }, [open]);

  return (
    <div className="xro-wins-control" ref={control}>
      <button
        type="button"
        className="xro-wins-toggle"
        id={`${id}-trigger`}
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {label("Labels.Wins")}
        <span className="xro-wins-chevron" aria-hidden="true" />
      </button>
      {open && (
        <section className="xro-wins-popover" id={id} role="region" aria-labelledby={`${id}-trigger`} tabIndex={0}>
          <div className="xro-wins-heading">{label("Labels.Leaderboard")}</div>
          <ul className="xro-wins-list">
            {model.tracker.map((participant) => (
              <li key={participant.userId} className={`xro-wins-player${participant.isCurrentUser ? " xro-wins-player--current" : ""}`}>
                <span className="xro-wins-name" title={participant.name}>{participant.name}</span>
                <WinProgress wins={participant.wins} target={model.winsNeeded} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const RollOffActionRow = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={`xro-roll-action xro-roll-action--row ${className}`.trim()}>
    {children}
  </div>
);

const RollOffApp = ({
  model,
  showHistory,
  areRollsSettled = true,
  onAction,
}: RollOffAppProps) => {
  const [busy, setBusy] = useState<RollOffAction | null>(null);
  const [rollAsUserId, setRollAsUserId] = useState<string | null>(null);
  const [shownResult, setShownResult] = useState<string | null>(null);
  const resultToken = areRollsSettled && model.hasData && (
    (model.isActive && model.roundComplete && model.roundResult) || !model.isActive
  ) ? JSON.stringify([model.sessionId ?? 'legacy', model.roundLabel, model.isActive,
    model.roundResult?.type, model.roundResult?.name, model.roundResult?.tieNames, model.winner?.id]) : null;
  const resultVisible = resultToken !== null && shownResult === resultToken;
  useEffect(() => {
    if (!resultToken) {
      setShownResult(null);
      return;
    }
    const timeout = setTimeout(() => setShownResult(resultToken), RESULT_MODAL_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [resultToken]);
  const busyRef = useRef(false);
  const localParticipant = model.tracker.find((player) => player.isCurrentUser);
  const localStatus = model.participantStatuses.find((player) => player.userId === localParticipant?.userId);
  const rollAsParticipant = model.tracker.find((player) => player.userId === rollAsUserId)
    ?? localParticipant;
  const rollAsDisplay = model.participantStatuses.find((player) => player.userId === rollAsParticipant?.userId)
    ?? model.users.find((player) => player.id === rollAsParticipant?.userId);
  const headerIdentity = model.isActive
    ? rollAsParticipant && { name: rollAsParticipant.name, avatar: rollAsDisplay?.avatar ?? "" }
    : model.winner;
  const roundPlayerCount = model.participantStatuses.length;
  const rolledCount = model.participantStatuses.filter((player) => player.rolled).length;
  const rollProgressLabel = game.i18n.format("XANDRA_ROLL_OFFS.Labels.RollsReceived", {
    count: rolledCount,
    total: roundPlayerCount,
  });
  // Split only a standalone trailing number; preserve full tiebreak/localized labels otherwise.
  const roundParts = model.isActive ? model.roundLabel.match(/^(.+?)\s+(\d+)$/u) : null;
  const heading = model.isActive
    ? model.roundLabel || label("Labels.RoundInProgress")
    : model.winner?.name ?? label("Labels.Winner");
  const dispatch = async (
    action: RollOffAction,
    payload?: any,
  ): Promise<boolean> => {
    if (busyRef.current) return false;
    const previousRollAsUserId = rollAsUserId;
    const changesIdentity = action === "rollFor" || action === "roll";
    if (action === "rollFor" && typeof payload === "string") setRollAsUserId(payload);
    if (action === "roll") setRollAsUserId(null);
    busyRef.current = true;
    setBusy(action);
    try {
      const accepted = (await onAction(action, payload)) !== false;
      if (!accepted && changesIdentity) setRollAsUserId(previousRollAsUserId);
      return accepted;
    } catch (error) {
      if (changesIdentity) setRollAsUserId(previousRollAsUserId);
      throw error;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  return (
    <div className="xro-app-content">
      {showHistory ? (
        <SessionHistory sessions={model.sessionHistory} />
      ) : !model.hasData ? (
        <SetupView
          model={model}
          onStart={(config) => dispatch("start", config)}
          onIdentityChange={(actorId) => dispatch("setGMIdentity", actorId)}
        />
      ) : (
        <>
          <header className="xro-live-banner">
            {headerIdentity ? (
              <div className="xro-header-identity">
                {headerIdentity.avatar ? (
                  <img className="xro-header-avatar" src={headerIdentity.avatar} alt="" />
                ) : (
                  <span className="xro-header-avatar xro-header-avatar--fallback" aria-hidden="true">
                    {Array.from(headerIdentity.name.trim())[0] ?? ""}
                  </span>
                )}
                <h2 className="xro-live-banner-copy" aria-label={model.isActive ? `${headerIdentity.name} — ${heading}` : headerIdentity.name}>
                  <span className="xro-header-eyebrow" aria-hidden="true">
                    {model.isActive ? heading : label("Labels.Winner")}
                  </span>
                  <strong className="xro-header-character-name" title={headerIdentity.name} aria-hidden="true">
                    {headerIdentity.name}
                  </strong>
                </h2>
              </div>
            ) : (
              <h2 className="xro-live-banner-copy" aria-label={heading}>
                <span className="xro-header-eyebrow" aria-hidden="true">
                  {roundParts?.[1] ?? label(model.isActive ? "Labels.CurrentRound" : "Labels.Winner")}
                </span>
                <strong className={roundParts ? "xro-header-round-number" : "xro-header-round-name"} aria-hidden="true">
                  {roundParts ? roundParts[2].padStart(2, "0") : heading}
                </strong>
              </h2>
            )}
            <div className="xro-header-utilities">
              <div className="xro-header-target">
                {game.i18n.format("XANDRA_ROLL_OFFS.Labels.FirstTo", { wins: model.winsNeeded })}
              </div>
              <div className="xro-header-utility-row">
                <span className="xro-header-progress" aria-live="polite" aria-atomic="true">
                  {model.isActive
                    ? roundPlayerCount > 0
                      ? rollProgressLabel
                      : game.i18n.format("XANDRA_ROLL_OFFS.Labels.PlayerCount", { count: model.tracker.length })
                    : label("Labels.ContestComplete")}
                </span>
                {model.tracker.length > 0 && <WinsPopover model={model} />}
              </div>
            </div>
          </header>
          {!model.isParticipant && (
            <div className="xro-not-participating">
              <i className="fas fa-eye" />
              <span>{label("Labels.NotParticipating")}</span>
            </div>
          )}
          <div
            className={`xro-window-body${!model.isActive && resultVisible ? " xro-window-body--complete" : ""}`}
          >
            <div className="xro-round-stage">
              <RoundTimeline
                history={model.roundHistory}
                current={model.participantStatuses}
                roundLabel={model.roundLabel}
                isActive={model.isActive}
                isGM={model.isGM}
                isParticipant={model.isParticipant}
                onRollFor={(userId) => void dispatch("rollFor", userId)}
              />
              {model.roundComplete && model.roundResult && resultVisible && (
                <div className="xro-round-result-modal" role="status">
                  <div
                    className={`xro-round-result-panel xro-round-result-panel--${model.roundResult.type}`}
                  >
                    <div className="xro-round-result-visual">
                      {model.roundResult.avatar && (
                        <img
                          className="xro-round-result-avatar"
                          src={model.roundResult.avatar}
                          alt={model.roundResult.name ?? ""}
                        />
                      )}
                      <div className="xro-round-result-emblem">
                        <i
                          className={`fas ${model.roundResult.type === "winner" ? "fa-trophy" : "fa-bolt"}`}
                        />
                      </div>
                    </div>
                    <div className="xro-round-result-panel-copy">
                      <div className="xro-round-result-panel-label">
                        {model.roundResult.type === "winner"
                          ? label("Labels.Winner")
                          : label("Labels.Tie")}
                      </div>
                      <div className="xro-round-result-panel-name">
                        {model.roundResult.name ?? model.roundResult.tieNames}
                      </div>
                      {model.isGM && (
                        <div className="xro-round-result-panel-hint">
                          {label("Labels.WaitingForGM")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div
              className={`xro-footer${model.isActive ? " xro-footer--active" : " xro-footer--complete"}`}
              aria-label={label("Labels.ContestActions")}
            >
              {model.isActive ? (
                <div className="xro-footer-primary">
                  {model.roundComplete && model.isGM ? (
                    <button
                      type="button"
                      className="xro-next-round-btn"
                      disabled={Boolean(busy)}
                      onClick={() => void dispatch("advance")}
                    >
                      {label("Actions.NextRound")}
                      <span className="xro-footer-next-arrow" aria-hidden="true">→</span>
                    </button>
                  ) : !model.roundComplete && model.canCurrentUserRoll ? (
                    <button
                      type="button"
                      className="xro-roll-btn"
                      disabled={Boolean(busy)}
                      onClick={() => void dispatch("roll")}
                    >
                      <i className="fas fa-dice" aria-hidden="true" />
                      {label("Actions.Roll")}
                    </button>
                  ) : (
                    <div className="xro-footer-status" role="status">
                      {localStatus?.rolling && <i className="fas fa-circle-notch xro-roll-spinner" role="img" aria-label={label("Labels.Rolling")} />}
                      {!model.roundComplete && localStatus?.rolled && !localStatus.rolling && (
                        <strong>{localStatus.value ?? "—"}</strong>
                      )}
                      <span>{model.roundComplete
                        ? label("Labels.WaitingForGM")
                        : localStatus?.rolling
                          ? null
                          : localStatus?.rolled
                          ? label("Labels.Rolled")
                          : label("Labels.Waiting")}</span>
                    </div>
                  )}
                </div>
               ) : resultVisible ? (
                <div className="xro-completion-modal">
                  <button
                    type="button"
                    onClick={() => void dispatch("closeWindow")}
                    className="xro-completion-close-btn"
                    title={label("Actions.Close")}
                    aria-label={label("Actions.Close")}
                  >
                    <span className="xro-close-glyph" aria-hidden="true" />
                  </button>
                  {model.winner && (
                    <div className="xro-winner-banner">
                      <img
                        className="xro-completion-avatar"
                        src={model.winner.avatar}
                        alt={model.winner.name}
                      />
                      <span className="xro-winner-label">
                        {label("Labels.Winner")}
                      </span>
                      <span className="xro-winner-name">
                        {model.winner.name}
                      </span>
                      <span className="xro-winner-score">
                        {label("Labels.Wins")}: {model.winner.score}
                      </span>
                    </div>
                  )}
                  {model.isGM && (
                    <RollOffActionRow>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void dispatch("closeRollOff")}
                        className="xro-close-roll-off-btn"
                      >
                        {label("Actions.CloseRollOff")}
                      </button>
                    </RollOffActionRow>
                  )}
                </div>
              ) : null}
              {model.isGM && model.isActive && (
                <div className="xro-footer-utilities" role="group" aria-label={label("Labels.GMControls")}>
                    {!model.roundComplete && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      className="xro-footer-utility"
                      title={label("Actions.ForceResolve")}
                      aria-label={label("Actions.ForceResolve")}
                      onClick={() => void dispatch("forceResolve")}
                    >
                      {label("Actions.RollMissing")}
                    </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      className="xro-footer-utility xro-footer-cancel"
                      title={label("Actions.Cancel")}
                      aria-label={label("Actions.Cancel")}
                      onClick={() => void dispatch("cancel")}
                    >
                      <span className="xro-close-glyph" aria-hidden="true" />
                    </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RollOffApp;
