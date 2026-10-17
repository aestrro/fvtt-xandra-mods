import type { SessionHistoryEntry } from '../../foundry/prepareViewModel';

interface SessionHistoryProps {
  sessions: SessionHistoryEntry[];
}

const SessionHistory = ({ sessions }: SessionHistoryProps) => <div className="xro-window-body xro-window-body--history">
  <header className="xro-surface-heading">
    <div className="xro-surface-heading-mark"><i className="fas fa-clock-rotate-left" /></div>
    <div className="xro-surface-heading-copy"><span className="xro-surface-kicker">Contest archive</span><strong>Session history</strong></div>
    <span className="xro-count-mark">{sessions.length}</span>
  </header>
  <div className="xro-session-history">
    {sessions.length === 0 && <div className="xro-history-empty">
      <span className="xro-history-empty-mark"><i className="fas fa-dice-d20" /></span>
      <strong>{game.i18n.localize('XANDRA_ROLL_OFFS.Labels.NoSessionHistory')}</strong>
      <span>Completed contests will appear here.</span>
    </div>}
    {sessions.map((session, sessionIndex) => <article key={session.id} className="xro-session-history-item">
      <div className="xro-history-index">{String(sessionIndex + 1).padStart(2, '0')}</div>
      <div className="xro-history-main">
        <header className="xro-session-history-header">
          <div className="xro-session-history-result">
            <span className="xro-session-history-kicker"><i className="fas fa-trophy" /> Contest complete</span>
            <strong>{session.winnerName}</strong>
          </div>
          <time dateTime={session.endedAt}>{session.endedLabel}</time>
        </header>
        <div className="xro-session-history-meta"><span>{session.dieType}</span><span className="xro-meta-separator" />
          <span>First to {session.winsNeeded}</span><span className="xro-meta-separator" /><span>{session.participants.length} contestants</span></div>
        <div className="xro-session-history-rounds">
          {session.history.map((round, index) => <div key={`${round.label}-${index}`}
            className={`xro-session-history-round ${round.isTie ? 'xro-session-history-round--tie' : ''}`}>
            <span className="xro-session-history-round-label">{round.label}</span>
            <span className="xro-session-history-round-winner">{round.winnerName}</span>
            <span className="xro-session-history-round-value">{round.winnerValue}</span>
          </div>)}
        </div>
      </div>
    </article>)}
  </div>
</div>;

export default SessionHistory;
