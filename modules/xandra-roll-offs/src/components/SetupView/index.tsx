import { useState } from "react";
import type { RollOffViewModel } from "../../foundry/prepareViewModel";
import GMIdentityPicker from "../GMIdentityPicker";

const label = (key: string) => game.i18n.localize(`XANDRA_ROLL_OFFS.${key}`);

interface SetupViewProps {
  model: RollOffViewModel;
  onStart: (config: {
    dieType: string;
    winsNeeded: number;
    participants: string[];
  }) => Promise<boolean>;
  onIdentityChange: (actorId: string) => Promise<boolean>;
}

const SetupView = ({ model, onStart, onIdentityChange }: SetupViewProps) => {
  const [selected, setSelected] = useState<string[]>(() => model.users.filter((user) => !user.isGM).map((user) => user.id));
  const [dieType, setDieType] = useState(model.defaultDieType);
  const [winsNeeded, setWinsNeeded] = useState(model.defaultWinsNeeded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);
  const gmIds = model.users.filter((user) => user.isGM).map((user) => user.id);
  const participants = [...gmIds, ...selected.filter((id) => model.users.some((user) => user.id === id && !user.isGM))];
  const currentUserId = model.currentUserId ?? gmIds[0];
  const changeIdentity = async (actorId: string) => {
    if (identityBusy || busy) return;
    setIdentityBusy(true);
    setError("");
    try {
      if (!(await onIdentityChange(actorId))) setError(label("Errors.IdentityUpdateFailed"));
    } catch {
      setError(label("Errors.IdentityUpdateFailed"));
    } finally {
      setIdentityBusy(false);
    }
  };
  const selection = new Set(selected);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const start = async () => {
    if (
      busy ||
      identityBusy ||
      participants.length < 2 ||
      !Number.isInteger(winsNeeded) ||
      winsNeeded < 1 ||
      winsNeeded > 20
    )
      return;
    setBusy(true);
    setError("");
    try {
      const accepted = await onStart({
        dieType,
        winsNeeded,
        participants,
      });
      if (!accepted)
        setError(
          game.i18n.localize("XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants"),
        );
    } catch {
      setError(
        game.i18n.localize("XANDRA_ROLL_OFFS.Errors.NeedTwoParticipants"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="xro-window-body xro-empty"
      onKeyDownCapture={(event) => {
        if (event.key === "Tab") setKeyboardFocus(true);
      }}
    >
      <header className="xro-setup-banner">
        <div className="xro-setup-banner-copy">
          {model.isGM && <span className="xro-header-eyebrow">{label("Labels.ChoosePlayers")}</span>}
          <strong>
            {label(model.isGM ? "Labels.StartHeading" : "Labels.NoActiveRollOff")}
          </strong>
        </div>
        {model.isGM && (
          <span className="xro-gm-selection-count" aria-live="polite">
            {game.i18n.format("XANDRA_ROLL_OFFS.Labels.SelectedCount", { count: participants.length })}
          </span>
        )}
      </header>
      {model.isGM && (
        <div className="xro-empty-content">
          <GMIdentityPicker
            choices={model.gmActorChoices ?? []}
            value={model.gmActorId ?? ''}
            fallback={model.gmDefaultIdentity ?? model.users.find((user) => user.id === currentUserId) ?? { name: label('Labels.UseGMName'), avatar: '' }}
            disabled={busy || identityBusy}
            onChange={changeIdentity}
          />
          <div className="xro-gm-participants xro-gm-participants--full">
            <div className="xro-gm-roster">
            <div
              className="xro-gm-selection-actions"
              role="group"
              aria-label={label("Labels.Participants")}
            >
              <button
                type="button"
                onClick={() => setSelected(model.users.filter((user) => !user.isGM).map((user) => user.id))}
              >
                {label("Actions.SelectAll")}
              </button>
              <button type="button" onClick={() => setSelected([])}>
                {label("Actions.Clear")}
              </button>
            </div>
            <div className="xro-gm-user-list" role="group" aria-label={label("Labels.Participants")}>
              {model.users.filter((user) => !user.isGM).map((user) => {
                const selectedRow = selection.has(user.id);
                const contents = <>
                  <span className="xro-gm-user-portrait">
                    <img className="xro-gm-user-avatar" src={user.avatar} alt="" />
                    <span
                      className={`xro-gm-user-status ${user.connected ? "xro-gm-user-status--online" : "xro-gm-user-status--offline"}`}
                      title={label(user.connected ? "Labels.Online" : "Labels.Offline")}
                    />
                  </span>
                  <span className="xro-gm-user-name" title={user.name}>{user.name}</span>
                  <span className="xro-gm-user-check" aria-hidden="true">
                    <i className="fas fa-check" />
                  </span>
                </>;
                const className = `xro-gm-user-row ${selectedRow ? "xro-gm-user-row--selected" : ""}`;
                return (
                <button
                  type="button"
                  key={user.id}
                  className={className}
                  data-selected={selectedRow}
                  aria-pressed={selectedRow}
                  onClick={() => toggle(user.id)}
                >
                  {contents}
                </button>
                );
              })}
            </div>
            </div>
          </div>
          <div className="xro-gm-footer">
            <div
              className="xro-setup-actionbar"
              data-keyboard-focus={keyboardFocus}
              onPointerDownCapture={() => setKeyboardFocus(false)}
            >
              <div className="xro-gm-row xro-gm-rules-row">
              <label className="xro-gm-field">
                <span className="xro-gm-field-label">
                  {label("Labels.DieType")}
                </span>
                <select
                  name="dieType"
                  className="xro-gm-select"
                  value={dieType}
                  onChange={(event) => setDieType(event.target.value)}
                >
                  {model.dieChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="xro-gm-field">
                <span className="xro-gm-field-label">
                  {label("Labels.WinsNeeded")}
                </span>
                <input
                  type="number"
                  name="winsNeeded"
                  min="1"
                  max="20"
                  value={winsNeeded}
                  className="xro-gm-input"
                  onChange={(event) =>
                    setWinsNeeded(Number(event.target.value))
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="xro-gm-start-btn"
              disabled={
                busy ||
                identityBusy ||
                participants.length < 2 ||
                !Number.isInteger(winsNeeded) ||
                winsNeeded < 1 ||
                winsNeeded > 20
              }
              onClick={() => void start()}
            >
              {label("Actions.Start")}
              <span aria-hidden="true">→</span>
            </button>
            </div>
            {error && (
              <p className="xro-setup-error" role="alert">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupView;
