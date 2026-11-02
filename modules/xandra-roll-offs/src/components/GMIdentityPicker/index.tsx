import { useEffect, useId, useRef, useState } from "react";

interface Identity {
  id: string;
  name: string;
  avatar: string;
}

interface GMIdentityPickerProps {
  choices: Identity[];
  value: string;
  fallback: { name: string; avatar: string };
  disabled: boolean;
  onChange: (actorId: string) => Promise<void>;
}

const label = (key: string) => game.i18n.localize(`XANDRA_ROLL_OFFS.${key}`);

const Portrait = ({ identity }: { identity: { name: string; avatar: string } }) =>
  identity.avatar ? (
    <img className="xro-identity-avatar" src={identity.avatar} alt="" />
  ) : (
    <span className="xro-identity-avatar xro-identity-avatar--fallback" aria-hidden="true">
      {Array.from(identity.name.trim())[0] ?? ""}
    </span>
  );

const GMIdentityPicker = ({ choices, value, fallback, disabled, onChange }: GMIdentityPickerProps) => {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  // Imported copies can have different document IDs but identical display identities.
  // Keep a selected copy rather than silently replacing the saved actor reference.
  const distinctChoices = new Map<string, Identity>();
  for (const choice of choices) {
    const key = JSON.stringify([choice.name.trim().toLocaleLowerCase(), choice.avatar]);
    if (!distinctChoices.has(key) || choice.id === value) distinctChoices.set(key, choice);
  }
  const options = [{ id: "", name: label("Labels.UseGMName"), avatar: fallback.avatar }, ...distinctChoices.values()];
  const selectedIndex = Math.max(0, options.findIndex((choice) => choice.id === value));
  const selected = choices.find((choice) => choice.id === value) ?? fallback;

  useEffect(() => {
    if (open) buttons.current[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="xro-gm-identity-picker" ref={root}>
      <span className="xro-identity-label" id={`${id}-label`}>{label("Labels.GMIdentity")}</span>
      <button
        type="button"
        className="xro-identity-trigger"
        ref={trigger}
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { setFocusedIndex(selectedIndex); setOpen((current) => !current); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setFocusedIndex(selectedIndex);
            setOpen(true);
          }
        }}
      >
        <Portrait identity={selected} />
        <span className="xro-identity-name" id={`${id}-value`}>{selected.name}</span>
        <span className="xro-wins-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="xro-identity-menu" id={id} role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((choice, index) => (
            <button
              type="button"
              role="option"
              key={choice.id}
              className="xro-identity-option"
              ref={(button) => { buttons.current[index] = button; }}
              aria-selected={index === selectedIndex}
              tabIndex={index === focusedIndex ? 0 : -1}
              onClick={() => { close(); void onChange(choice.id); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  setFocusedIndex(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
                }
              }}
            >
              <Portrait identity={choice} />
              <span className="xro-identity-name">{choice.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GMIdentityPicker;
