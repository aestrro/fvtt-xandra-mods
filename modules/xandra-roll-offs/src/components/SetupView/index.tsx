import { useState } from 'react';
import type { RollOffViewModel } from '../../foundry/prepareViewModel';

interface SetupViewProps {
  model: RollOffViewModel;
  onStart: (config: { dieType: string; winsNeeded: number; participants: string[] }) => Promise<boolean>;
}

const SetupView = ({ model, onStart }: SetupViewProps) => {
  const [selected, setSelected] = useState<string[]>(() => {
    const includeGM = game.settings.get('xandra-roll-offs', 'includeGMByDefault');
    return model.users.filter((user) => includeGM || !user.isGM).map((user) => user.id);
  });
  const [dieType, setDieType] = useState(model.defaultDieType);
  const [winsNeeded, setWinsNeeded] = useState(model.defaultWinsNeeded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selection = new Set(selected);
  const toggle = (id: string) => setSelected((current) => current.includes(id)
    ? current.filter((value) => value !== id) : [...current, id]);
  const start = async () => {
    if (busy || selected.length < 2 || !Number.isInteger(winsNeeded) || winsNeeded < 1 || winsNeeded > 20) return;
    setBusy(true);
    setError('');
    try {
      const accepted = await onStart({ dieType, winsNeeded, participants: selected });
      if (!accepted) setError(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants'));
    } catch {
      setError(game.i18n.localize('XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants'));
    }
    finally { setBusy(false); }
  };
  return <div className="xro-window-body xro-empty">
    <header className="xro-setup-banner">
      <div className="xro-setup-banner-icon"><i className="fas fa-dice-d20" /></div>
      <div className="xro-setup-banner-copy"><span className="xro-surface-kicker">Xandra Roll-Offs</span>
        <strong>{game.i18n.localize('XANDRA_ROLL_OFFS.Labels.NoActiveRollOff')}</strong></div>
      <span className="xro-setup-ready-mark"><i className="fas fa-circle" /> Ready</span>
    </header>
    {model.isGM && <div className="xro-empty-content">
      <div className="xro-gm-participants xro-gm-participants--full">
        <div className="xro-gm-section-heading"><div><span className="xro-gm-section-kicker">01 / CONTESTANTS</span>
          <strong>Choose players</strong></div><span className="xro-gm-selection-count"><b>{String(selected.length).padStart(2, '0')}</b> selected</span></div>
        <div className="xro-gm-selection-actions" role="group" aria-label="Participant selection">
          <button type="button" onClick={() => setSelected(model.users.map((user) => user.id))}>Select all</button>
          <button type="button" onClick={() => setSelected([])}>Clear</button>
        </div>
        <div className="xro-gm-user-list">
          {model.users.map((user, index) => <button type="button" key={user.id}
            className={`xro-gm-user-row ${selection.has(user.id) ? 'xro-gm-user-row--selected' : ''}`}
            data-selected={selection.has(user.id)} aria-pressed={selection.has(user.id)}
            onClick={() => toggle(user.id)}>
            <span className="xro-gm-user-index">{String(index + 1).padStart(2, '0')}</span>
            <img className="xro-gm-user-avatar" src={user.avatar} alt="" />
            <span className="xro-gm-user-name" title={user.name}>{user.name}</span>
            <span className={`xro-gm-user-status ${user.connected ? 'xro-gm-user-status--online' : 'xro-gm-user-status--offline'}`}
              title={user.connected ? 'Online' : 'Offline'} />
            <span className="xro-gm-user-check"><i className="fas fa-check" /></span>
          </button>)}
        </div>
      </div>
      <div className="xro-gm-footer">
        <div className="xro-gm-rules-heading"><span className="xro-gm-section-kicker">02 / RULES</span>
          <span>{dieType} <i className="fas fa-arrow-right" /> First to {winsNeeded}</span></div>
        <div className="xro-gm-row xro-gm-rules-row">
          <label className="xro-gm-field"><span className="xro-gm-field-label"><i className="fas fa-dice-d20" /> Die type</span>
            <select name="dieType" className="xro-gm-select" value={dieType} onChange={(event) => setDieType(event.target.value)}>
              {model.dieChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select></label>
          <label className="xro-gm-field"><span className="xro-gm-field-label"><i className="fas fa-trophy" /> Wins needed</span>
            <input type="number" name="winsNeeded" min="1" max="20" value={winsNeeded} className="xro-gm-input"
              onChange={(event) => setWinsNeeded(Number(event.target.value))} /></label>
        </div>
        {error && <p className="xro-setup-error" role="alert">{error}</p>}
        <button type="button" className="xro-gm-start-btn" disabled={busy || selected.length < 2 || !Number.isInteger(winsNeeded) || winsNeeded < 1 || winsNeeded > 20}
          onClick={() => void start()}><i className="fas fa-play" /> {game.i18n.localize('XANDRA_ROLL_OFFS.Actions.Start')}</button>
      </div>
    </div>}
  </div>;
};

export default SetupView;
