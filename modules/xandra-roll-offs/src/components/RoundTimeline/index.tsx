import { useEffect, useRef, useState } from "react";
import type {
  HistoryRound,
  ParticipantStatus,
  RollDisplay,
} from "../../foundry/prepareViewModel";

const FOLLOW_LATEST_THRESHOLD = 80;

interface RoundScrollerProps {
  key?: string;
  label: string;
  rolls: RollDisplay[];
  current?: boolean;
  alternate?: boolean;
  isTie?: boolean;
  isParticipant?: boolean;
  isGM?: boolean;
  onRollFor?: (userId: string) => void;
}

const RoundScroller = ({
  label,
  rolls,
  current,
  alternate,
  isTie,
  isParticipant,
  isGM,
  onRollFor,
}: RoundScrollerProps) => {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ scrollable: false, left: false, right: false });
  const updateEdges = () => {
    const element = row.current;
    if (!element) return;
    // Compare against the entire wrapper, not the space remaining after arrow gutters.
    const availableWidth = element.parentElement?.clientWidth || element.clientWidth;
    const scrollable = element.scrollWidth > availableWidth + 1;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({
      scrollable,
      left: scrollable && element.scrollLeft > 1,
      right: scrollable && max > 1 && element.scrollLeft < max - 1,
    });
  };
  useEffect(() => {
    updateEdges();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateEdges);
    if (row.current) {
      observer?.observe(row.current);
      if (row.current.parentElement) observer?.observe(row.current.parentElement);
    }
    return () => observer?.disconnect();
  }, [rolls.length]);
  return (
    <div
      className={`xro-round-group ${current ? "xro-round-group--current" : `xro-round-group--history${alternate ? " xro-round-group--alt" : ""}`}`}
    >
      <div className="xro-round-title-row">
        <div className="xro-round-title">
          <span>{label}</span>
          {current && <span className="xro-round-current-label">{game.i18n.localize("XANDRA_ROLL_OFFS.Labels.Current")}</span>}
          {isTie && <span className="xro-round-tie-label">{game.i18n.localize("XANDRA_ROLL_OFFS.Labels.Tiebreak")}</span>}
        </div>
      </div>
      <div
        className={`xro-round-scroller ${edges.scrollable ? "xro-round-scroller--scrollable" : ""}`}
      >
        <button
          type="button"
          className="xro-row-nav xro-row-nav--left"
          disabled={!edges.left}
          aria-label="Scroll round left"
          onClick={() =>
            row.current?.scrollBy({
              left: -Math.max((row.current?.clientWidth ?? 0) * 0.72, 120),
              behavior: "smooth",
            })
          }
        >
          <i className="fas fa-chevron-left" />
        </button>
        <div className="xro-round-row" ref={row} onScroll={updateEdges} tabIndex={0} role="group" aria-label={label}>
          {rolls.map((roll) => (
            <div
              key={roll.userId}
              className={`xro-roll-pill ${current ? (roll.rolled ? "xro-roll-pill--rolled" : "xro-roll-pill--waiting") : roll.isWinner ? "xro-roll-pill--winner" : ""}${roll.rolling ? " xro-roll-pill--rolling" : ""}`}
            >
              <img className="xro-avatar" src={roll.avatar} alt={roll.name} />
              <div className="xro-player-result">
               {current && isGM && !roll.rolled && !roll.rolling ? (
                <button
                  type="button"
                  className="xro-pill-roll-btn"
                  disabled={!isParticipant}
                  title={`Roll for ${roll.name}`}
                  aria-label={`Roll for ${roll.name}`}
                  onClick={() => onRollFor?.(roll.userId)}
                >
                  <i className="fas fa-dice-d20" aria-hidden="true" />
                </button>
              ) : (
                <span
                  className="xro-roll-pill-value"
                  aria-label={!current && roll.isWinner ? `${game.i18n.localize("XANDRA_ROLL_OFFS.Labels.Winner")}: ${roll.value ?? "-"}` : undefined}
                >
                  {roll.rolling ? (
                    <i className="fas fa-circle-notch xro-roll-spinner" role="img" aria-label={game.i18n.localize('XANDRA_ROLL_OFFS.Labels.Rolling')} />
                  ) : roll.rolled
                    ? (roll.value ?? "-")
                    : current
                      ? "-"
                      : (roll.value ?? "-")}
                </span>
              )}
              </div>
              <span className="xro-roll-pill-name" title={roll.name}>
                {roll.name}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="xro-row-nav xro-row-nav--right"
          disabled={!edges.right}
          aria-label="Scroll round right"
          onClick={() =>
            row.current?.scrollBy({
              left: Math.max((row.current?.clientWidth ?? 0) * 0.72, 120),
              behavior: "smooth",
            })
          }
        >
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
};

interface RoundTimelineProps {
  history: HistoryRound[];
  current: ParticipantStatus[];
  roundLabel: string;
  isActive: boolean;
  isGM: boolean;
  isParticipant: boolean;
  onRollFor: (userId: string) => void;
}

const RoundTimeline = ({
  history,
  current,
  roundLabel,
  isActive,
  isGM,
  isParticipant,
  onRollFor,
}: RoundTimelineProps) => {
  const historyStack = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    const element = historyStack.current;
    if (!element) return;
    if (followLatest.current) element.scrollTop = element.scrollHeight;
  }, [history.length, roundLabel, isActive]);
  return (
    <>
      <div
        className="xro-scroll-stack"
        ref={historyStack}
        onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_LATEST_THRESHOLD;
        }}
      >
        <div className="xro-scroll-stack-content">
          {history.map((round, index) => (
            <RoundScroller
              key={`${round.label}-${index}`}
              label={round.label}
              rolls={round.rolls}
              alternate={index % 2 !== 0}
              isTie={round.isTie}
            />
          ))}
        </div>
      </div>
      {isActive && (
        <div className="xro-current-round">
          <RoundScroller
            label={roundLabel}
            rolls={current}
            current
            isGM={isGM}
            isParticipant={isParticipant}
            onRollFor={onRollFor}
          />
        </div>
      )}
      {!isActive && history.length === 0 && (
        <div className="xro-empty-rounds">
          {game.i18n.localize("XANDRA_ROLL_OFFS.Labels.NoRoundsYet")}
        </div>
      )}
    </>
  );
};

export default RoundTimeline;
