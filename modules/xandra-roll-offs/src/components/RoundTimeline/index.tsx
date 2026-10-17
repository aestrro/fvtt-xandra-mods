import { useEffect, useRef, useState } from 'react';
import type { HistoryRound, ParticipantStatus, RollDisplay } from '../../foundry/prepareViewModel';

interface RoundScrollerProps {
  key?: string;
  label: string;
  rolls: RollDisplay[];
  current?: boolean;
  alternate?: boolean;
  isParticipant?: boolean;
  isGM?: boolean;
  onRollFor?: (userId: string) => void;
}

const RoundScroller = ({ label, rolls, current, alternate, isParticipant, isGM, onRollFor }: RoundScrollerProps) => {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = () => {
    const element = row.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({ left: element.scrollLeft > 1, right: max > 1 && element.scrollLeft < max - 1 });
  };
  useEffect(() => {
    updateEdges();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    if (row.current) observer?.observe(row.current);
    return () => observer?.disconnect();
  }, [rolls.length]);
  return <div className={`xro-round-group ${current ? 'xro-round-group--current' : alternate ? 'xro-round-group--alt' : ''}`}>
    <div className="xro-round-title"><span className="xro-round-marker">{current ? <i className="fas fa-crosshairs" /> : <i className="fas fa-dice-d20" />}</span>
      <span>{label}</span>
      {current && <span className="xro-round-live-mark"><i className="fas fa-circle" /> LIVE</span>}</div>
    <div className={`xro-round-scroller ${edges.left || edges.right ? 'xro-round-scroller--scrollable' : ''}`}>
      <button type="button" className="xro-row-nav xro-row-nav--left" disabled={!edges.left}
        aria-label="Scroll round left" onClick={() => row.current?.scrollBy({ left: -Math.max((row.current?.clientWidth ?? 0) * 0.72, 120), behavior: 'smooth' })}>
        <i className="fas fa-chevron-left" />
      </button>
      <div className="xro-round-row" ref={row} onScroll={updateEdges}>
        {rolls.map((roll) => <div key={roll.userId}
          className={`xro-roll-pill ${current ? roll.rolled ? 'xro-roll-pill--rolled' : 'xro-roll-pill--waiting' : roll.isWinner ? 'xro-roll-pill--winner' : ''}`}>
          <img className="xro-avatar" src={roll.avatar} alt={roll.name} />
          <span className="xro-roll-pill-value">{roll.value ?? '-'}</span>
          <span className="xro-roll-pill-name" title={roll.name}>{roll.name}</span>
          {current && isGM && !roll.rolled && <button type="button" className="xro-pill-roll-btn"
            disabled={!isParticipant}
            title={`Roll for ${roll.name}`} aria-label={`Roll for ${roll.name}`}
            onClick={() => onRollFor?.(roll.userId)}><i className="fas fa-dice" /></button>}
        </div>)}
      </div>
      <button type="button" className="xro-row-nav xro-row-nav--right" disabled={!edges.right}
        aria-label="Scroll round right" onClick={() => row.current?.scrollBy({ left: Math.max((row.current?.clientWidth ?? 0) * 0.72, 120), behavior: 'smooth' })}>
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  </div>;
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

const RoundTimeline = ({ history, current, roundLabel, isActive, isGM, isParticipant, onRollFor }: RoundTimelineProps) => {
  const stack = useRef<HTMLDivElement>(null);
  const previousCount = useRef(-1);
  useEffect(() => {
    const element = stack.current;
    if (!element || previousCount.current === history.length) return;
    const atBottom = previousCount.current < 0 || element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (atBottom) element.scrollTop = element.scrollHeight;
    previousCount.current = history.length;
  }, [history.length]);
  return <div className="xro-scroll-stack" ref={stack}>
    <div className="xro-scroll-stack-content">
      {history.map((round, index) => <RoundScroller key={`${round.label}-${index}`} label={round.label} rolls={round.rolls} alternate={index % 2 !== 0} />)}
      {isActive && <RoundScroller label={`${roundLabel} · Current`} rolls={current}
        current isGM={isGM} isParticipant={isParticipant} onRollFor={onRollFor} />}
      {!isActive && history.length === 0 && <div className="xro-empty-rounds">{game.i18n.localize('XANDRA_ROLL_OFFS.Labels.NoRoundsYet')}</div>}
    </div>
  </div>;
};

export default RoundTimeline;
