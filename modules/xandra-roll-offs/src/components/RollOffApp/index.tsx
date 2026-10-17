import { useRef, useState } from 'react';
import type { RollOffViewModel } from '../../foundry/prepareViewModel';
import RoundTimeline from '../RoundTimeline';
import SessionHistory from '../SessionHistory';
import SetupView from '../SetupView';

export type RollOffAction = 'roll' | 'rollFor' | 'advance' | 'forceResolve' | 'cancel' | 'closeRollOff' | 'closeWindow' | 'start';

interface RollOffAppProps {
  model: RollOffViewModel;
  showHistory: boolean;
  onAction: (action: RollOffAction, payload?: any) => Promise<unknown>;
}

const label = (key: string) => game.i18n.localize(`XANDRA_ROLL_OFFS.${key}`);

const RollOffApp = ({ model, showHistory, onAction }: RollOffAppProps) => {
  const [trackerExpanded, setTrackerExpanded] = useState(false);
  const [busy, setBusy] = useState<RollOffAction | null>(null);
  const busyRef = useRef(false);
  const dispatch = async (action: RollOffAction, payload?: any): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(action);
    try { return (await onAction(action, payload)) !== false; }
    finally { busyRef.current = false; setBusy(null); }
  };
  return <div className="xro-app-content">
    {showHistory ? <SessionHistory sessions={model.sessionHistory} />
      : !model.hasData ? <SetupView model={model} onStart={(config) => dispatch('start', config)} />
        : <>
        <header className="xro-live-banner">
          <div className={`xro-live-state-mark ${model.isActive ? 'is-active' : 'is-complete'}`}><i className={`fas ${model.isActive ? 'fa-dice' : 'fa-trophy'}`} /></div>
          <div className="xro-live-banner-copy"><span className="xro-surface-kicker">{model.isActive ? 'Live contest' : 'Contest complete'}</span>
            <strong>{model.isActive ? model.roundLabel || 'Round in progress' : model.winner?.name ?? label('Labels.Winner')}</strong></div>
          <div className="xro-live-banner-meta"><span><i className="fas fa-trophy" /> First to {model.winsNeeded}</span>
            <span className="xro-live-meta-divider" /><span><i className="fas fa-users" /> {model.tracker.length} players</span></div>
        </header>
        {!model.isParticipant && <div className="xro-not-participating"><i className="fas fa-eye" />
          <span>{label('Labels.NotParticipating')}</span></div>}
        <div className="xro-window-body">
          <RoundTimeline history={model.roundHistory} current={model.participantStatuses}
            roundLabel={model.roundLabel} isActive={model.isActive} isGM={model.isGM}
            isParticipant={model.isParticipant}
            onRollFor={(userId) => void dispatch('rollFor', userId)} />
          {model.roundComplete && model.roundResult && <div className={`xro-round-result-panel xro-round-result-panel--${model.roundResult.type}`}>
            <div className="xro-round-result-emblem"><i className={`fas ${model.roundResult.type === 'winner' ? 'fa-trophy' : 'fa-bolt'}`} /></div>
            <div className="xro-round-result-panel-copy"><div className="xro-round-result-panel-label">{model.roundResult.type === 'winner' ? label('Labels.Winner') : label('Labels.Tie')}</div>
            <div className="xro-round-result-panel-name">{model.roundResult.name ?? model.roundResult.tieNames}</div>
            {model.isGM && <div className="xro-round-result-panel-hint">{label('Labels.WaitingForGM')}</div>}</div>
          </div>}
          {model.tracker.length > 0 && <div className="xro-tracker" data-expanded={trackerExpanded}>
            <button type="button" className="xro-tracker-header" aria-expanded={trackerExpanded}
              onClick={() => setTrackerExpanded((value) => !value)}>
              <span className="xro-tracker-header-text">{label('Labels.Wins')}</span>
              <span className="xro-tracker-header-icon"><i className="fas fa-chevron-down" /></span>
            </button>
            <div className="xro-tracker-rows">{model.tracker.map((participant, index) => <div key={participant.userId}
              className={`xro-tracker-row ${participant.isCurrentUser ? 'xro-tracker-row--current' : index === 0 && !model.tracker.some((entry) => entry.isCurrentUser) ? 'xro-tracker-row--preview' : ''}`}>
              <span className="xro-tracker-name" title={participant.name}>{participant.name}</span>
              <div className="xro-tracker-slots">{participant.slots.map((slot: { won: boolean }, index: number) => <span key={index}
                className={`xro-tracker-slot ${slot.won ? 'xro-tracker-won' : 'xro-tracker-empty'}`}>
                {slot.won ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" /></svg>
                  : <svg viewBox="0 0 24 24" aria-hidden="true" strokeWidth="1"><circle cx="12" cy="12" r="9" /></svg>}
              </span>)}</div>
            </div>)}</div>
          </div>}
          <div className="xro-footer">
            {model.isActive ? model.roundComplete ? <div className="xro-roll-action">{model.isGM
              ? <button type="button" className="xro-next-round-btn" disabled={Boolean(busy)}
                onClick={() => void dispatch('advance')}>{label('Actions.NextRound')}</button>
              : <button type="button" disabled className="xro-waiting-btn">{label('Labels.WaitingForGM')}</button>}</div>
              : model.canCurrentUserRoll ? <div className="xro-roll-action"><button type="button" className="xro-roll-btn"
                disabled={Boolean(busy)} onClick={() => void dispatch('roll')}>{label('Actions.Roll')}</button></div>
                : <div className="xro-roll-action"><button type="button" disabled className="xro-waiting-btn">{label('Actions.Roll')}</button></div>
              : <>
                {model.winner && <div className="xro-winner-banner"><span className="xro-winner-label">{label('Labels.Winner')}</span>
                  <span className="xro-winner-name">{model.winner.name}</span><span className="xro-winner-score">{label('Labels.Wins')}: {model.winner.score}</span></div>}
                <div className="xro-roll-action"><button type="button" disabled className="xro-waiting-btn">{label('Actions.Roll')}</button></div>
                {model.isGM && <div className="xro-roll-action xro-roll-action--row">
                  <button type="button" disabled={Boolean(busy)} onClick={() => void dispatch('closeRollOff')}
                    className="xro-close-roll-off-btn">{label('Actions.CloseRollOff')}</button>
                  <button type="button" onClick={() => void dispatch('closeWindow')}>{label('Actions.Close')}</button>
                </div>}
              </>}
            {model.isGM && model.isActive && <div className="xro-gm-controls"><div className="xro-gm-actions"><div className="xro-gm-btn-row">
              <button type="button" disabled={Boolean(busy)} className="xro-gm-btn"
                title="Roll for Missing Participants" aria-label="Roll for Missing Participants" onClick={() => void dispatch('forceResolve')}>
                <i className="fas fa-bolt" /></button>
              <button type="button" disabled={Boolean(busy)} className="xro-gm-btn xro-cancel-btn"
                title="Cancel Roll-Off" aria-label="Cancel Roll-Off" onClick={() => void dispatch('cancel')}>
                <i className="fas fa-times" /></button>
            </div></div></div>}
          </div>
        </div>
        </>}
  </div>;
};

export default RollOffApp;
