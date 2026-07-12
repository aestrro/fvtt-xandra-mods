# Foundry VTT Module Specification: `xandra-roll-offs`

**Target platform:** Foundry Virtual Tabletop, current API (V14, namespaced `foundry.*` API, `ApplicationV2`)
**Module type:** Standard module (not a system), GM-authoritative, socket-driven
**Status:** Ready for implementation

---

## 1. Purpose

A GM-run "roll-off" tool: the GM specifies a die type (e.g. `d20`, `d100`) and a number of rounds. Each round, all participating users — including the GM if they choose to participate — roll once. The highest roll wins the round. If two or more participants tie for highest, only the tied participants roll again ("tiebreak"), recursively, until a single winner emerges. Each participant accumulates a persistent tally of total rounds won, visible to the GM (and optionally players).

---

## 2. Terminology

| Term            | Definition                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Roll-Off**    | A GM-configured session consisting of N rounds, a die type, and a set of participants.                                                        |
| **Round**       | One resolution cycle within a roll-off. Produces exactly one winner.                                                                        |
| **Tiebreak**    | A sub-round scoped only to the participants tied for highest in the parent round. Uses the same die type. Recursive — a tiebreak can itself tie. |
| **Participant** | A user included in the roll-off. GM chooses participants at start (default: all connected users, including the GM, adjustable).          |
| **Tally**       | Persistent, cross-session count of total rounds won per user.                                                                               |

---

## 3. Functional Requirements

1. GM can configure and start a roll-off: die type (`d20`, `d100`, or arbitrary custom formula like `2d6`), number of rounds, and participant list.
2. Only one roll-off can be active at a time (v1 scope — see §12 for future multi-session support).
3. Each participant can submit exactly one roll per round (and one roll per tiebreak sub-round they're part of).
4. Rolls are evaluated **authoritatively** — never trust a client-submitted numeric result (see §9, Security).
5. When all expected participants for the current round/tiebreak have rolled, the winner is resolved automatically:
   - Single highest roller → round winner. Their tally increments by 1. Move to next round (or end roll-off if that was the last round).
   - Multiple participants tied for highest → spawn a tiebreak round scoped to only those participants, same die type. The round is **not** considered resolved, and no tally increments, until the tiebreak (and any nested tiebreak) produces a single winner.
6. Every roll and every round/tiebreak resolution is posted to chat automatically for a visible audit trail.
7. GM has a live view of: current round number, who has/hasn't rolled yet, current roll values, tiebreak nesting state, and the running tally leaderboard.
8. Participants have a simple "Roll" prompt/button that appears when it's their turn to roll (i.e., they're a participant in the current active round/tiebreak and haven't rolled yet).
9. Participants may also roll by typing a standard Foundry `/roll` command whose expression matches the configured die pattern allowed by the GM.
10. Win tallies persist across roll-off sessions until the GM explicitly resets them.
11. GM can cancel/abort an active roll-off at any time.

---

## 4. Non-Functional Requirements

- Must work correctly with Foundry's client-server model: the GM's client (or a designated primary-GM client if multiple GMs are connected) is the single source of truth for roll evaluation and state transitions.
- Must degrade gracefully if the GM disconnects mid-roll-off (state persists in world settings; GM can resume on reconnect — no requirement to auto-elect a new authority in v1, but don't crash).
- No modification of core Foundry behavior — pure module, uses only public/documented APIs.
- Should work in any system (dnd5e, pf2e, generic, etc.) — do not depend on system-specific actor/sheet data. This is a pure user-vs-user meta-game tool, not tied to character sheets.

---

## 5. API & Conventions (current Foundry API — do not use deprecated V1 patterns)

- **Dice:** `foundry.dice.Roll` for constructing/evaluating rolls. `Roll#evaluate()` is asynchronous — always `await` it. Use `Roll#toMessage()` or `ChatMessage.create()` to post to chat.
- **Hooks:** `foundry.helpers.Hooks` (or global `Hooks`, which is aliased) — use `init` to register settings, load templates, and register the socket handler; `ready` for anything needing fully-loaded world data.
- **Applications:** Build all UI on `foundry.applications.api.ApplicationV2` with `HandlebarsApplicationMixin`. Import via `const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;`. Do **not** use the deprecated `Application`/`FormApplication` V1 classes.
- **Templates:** Declare in `static PARTS = { partId: { template: 'modules/xandra-roll-offs/templates/...' } }`. Load templates with `foundry.applications.handlebars.loadTemplates([...])` during `init`.
- **Actions:** Use `data-action` buttons wired through `DEFAULT_OPTIONS.actions`. Handler signature is `(event, target)` with `this` bound to the app instance.
- **Form fields:** Use `foundry.applications.fields.createSelectInput`, `createNumberInput`, `createFormGroup`, etc. for programmatic GM-panel inputs, or plain HTML inputs in Handlebars templates.
- **Settings:** `game.settings.register(...)` for persisted state (see §6). World-scope settings are readable by all clients but should only be **written** by GM-side code.
- **Sockets:** Register a namespaced socket handler on the `init` hook, stored on `game.modules.get("xandra-roll-offs")`, per the standard community pattern (see §9).
- **Permissions:** Gate all state-mutating logic with `game.user.isGM` checks on the executing (GM) side. Player clients only ever _request_ actions via socket; they never write directly to world settings.

---

## 6. Data Model

Two world-scope settings (`scope: "world"`, `config: false`, restricted to GM read/write via module logic — Foundry settings themselves are readable by all clients but should only be _written_ by GM-side code).

### 6.1 `xandra-roll-offs.activeRollOff`

```jsonc
{
  "active": true,
  "dieType": "1d20",       // Roll formula, GM-specified
  "totalRounds": 3,        // Number of top-level rounds
  "currentRoundIndex": 0,  // 0-based index into totalRounds
  "participants": ["userId1", "userId2", "userId3"], // Fixed for the whole roll-off; may include the GM
  "roundStack": [
    {
      "label": "Round 1",
      "participants": ["userId1", "userId2", "userId3"],
      "dieType": "1d20",
      "rolls": {
        "userId1": { "total": 14, "rollId": "abc123" },
        "userId2": { "total": 14, "rollId": "def456" },
        // userId3 not yet present = hasn't rolled
      },
      "resolved": false,
      "parent": null,
    },
    // If a tie occurs, a new entry is pushed here, e.g. "Round 1 - Tiebreak",
    // participants: ["userId1", "userId2"], parent: reference/index of Round 1 entry.
    // Only the LAST entry in roundStack is ever active/rollable.
  ],
  "history": [
    { "round": 1, "winner": "userId3", "finalRolls": { "...": "..." } },
    // Populated as top-level rounds resolve (tiebreaks collapse into the parent entry)
  ],
}
```

When `active` is `false` (or the setting is at its default), there is no roll-off in progress and the GM panel shows the "configure new roll-off" state.

### 6.2 `xandra-roll-offs.winTallies`

```jsonc
{
  "userId1": 4,
  "userId2": 2,
  "userId3": 7,
}
```

Persists independently of `activeRollOff`. Only mutated when a **top-level round** (not a raw tiebreak) fully resolves to a single winner. Reset only via explicit GM action ("Reset Tallies" button), which sets this back to `{}`.

---

## 7. Round Resolution Algorithm

Pure function, no side effects beyond what's described — this is the core logic and should be unit-testable in isolation from Foundry APIs where possible.

```
function resolveRound(rollsMap):
    # rollsMap: { userId: totalValue }
    maxValue = max(rollsMap.values())
    winners = [userId for userId, value in rollsMap if value == maxValue]

    if len(winners) == 1:
        return { type: "winner", userId: winners[0] }
    else:
        return { type: "tie", userIds: winners }
```

**Orchestration (GM-side, runs after every roll submission, only when the active round/tiebreak has a roll from every expected participant):**

```
function onAllRolledIn(activeRollOff):
    top = last(activeRollOff.roundStack)
    result = resolveRound(top.rolls)

    if result.type == "winner":
        mark top.resolved = true
        if top.parent is null:
            # Top-level round resolved cleanly, no tiebreak was needed
            incrementTally(result.userId)
            appendToHistory(activeRollOff, top, result.userId)
            advanceToNextRoundOrEnd(activeRollOff)
        else:
            # A tiebreak chain resolved — walk up to the original top-level round
            originalRound = findRootRound(top)
            incrementTally(result.userId)
            appendToHistory(activeRollOff, originalRound, result.userId)
            advanceToNextRoundOrEnd(activeRollOff)

    else: # tie
        newTiebreak = {
            label: top.label + " - Tiebreak",
            participants: result.userIds,
            dieType: activeRollOff.dieType,   # same die type throughout
            rolls: {},
            resolved: false,
            parent: reference to top
        }
        push newTiebreak onto activeRollOff.roundStack
        broadcast "tiebreakStarted" with newTiebreak

    persist activeRollOff to world setting
    broadcast "stateUpdated" with activeRollOff
```

```
function advanceToNextRoundOrEnd(activeRollOff):
    # Pop all resolved tiebreaks back to a clean stack, keep only history
    reset roundStack to just the history entries collapsed away
    if activeRollOff.currentRoundIndex + 1 >= activeRollOff.totalRounds:
        activeRollOff.active = false
        broadcast "rollOffEnded" with final standings
    else:
        activeRollOff.currentRoundIndex += 1
        pushNewRound(activeRollOff)  # fresh round, full participant list, same dieType
        broadcast "roundStarted" with new round
```

**Key invariant:** only the _last_ entry in `roundStack` is ever active for rolling. Everything before it is historical/resolved context for that top-level round.

---

## 8. Socket Protocol

Namespace: `module.xandra-roll-offs`

Registered per the standard pattern:

```js
Hooks.once("init", () => {
  const mod = game.modules.get("xandra-roll-offs");
  mod.socketHandler = new RollOffSocketHandler();
});
```

| Event                 | Direction                           | Payload                                  | Handled by         | Purpose                                                                                                                                    |
| --------------------- | ----------------------------------- | ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestStartRollOff` | Player→GM (rare; normally GM-local) | `{ dieType, totalRounds, participants }` | GM (authoritative) | GM UI triggers this locally; no real network need unless multi-GM.                                                                         |
| `submitRoll`          | Player/GM→GM                        | `{ userId, roundLabel }`                 | GM (authoritative) | Participant requests their roll be executed. GM client evaluates the actual `Roll` server-of-truth-side, never trusts a number from the player. |
| `stateUpdated`        | GM→All                              | full `activeRollOff` object              | All clients        | Refresh UI: who's rolled, current standings, round label.                                                                                  |
| `roundStarted`        | GM→All                              | round object                             | All clients        | New round/tiebreak began; show "Roll" button to relevant participants.                                                                     |
| `tiebreakStarted`     | GM→All                              | tiebreak round object                    | All clients        | Same as above but for a tie; only tied participants see the Roll button.                                                                   |
| `rollOffEnded`        | GM→All                              | `{ winnerByRound: [...], finalTallies }` | All clients        | Show final summary card.                                                                                                                   |
| `rollOffCancelled`    | GM→All                              | `{}`                                     | All clients        | GM aborted; clear all player UI.                                                                                                           |

**Security note:** `submitRoll` must NOT carry a pre-computed result from the participant. The GM client receives only "user X wants to roll now," constructs and evaluates `new foundry.dice.Roll(dieType)` itself, records the result, and broadcasts it. This prevents a modified client from injecting a fake high roll.

If you want resilience against a single point of failure (only one GM client acting as authority), note it as a v2 concern — not required for v1.

---

## 9. Module Manifest (`module.json`) — skeleton

```json
{
  "id": "xandra-roll-offs",
  "title": "Xandra Roll-Offs",
  "description": "GM-run, multi-round roll-off contests with automatic tiebreak resolution and persistent win tallies.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14"
  },
  "esmodules": ["scripts/main.js"],
  "styles": ["styles/xandra-roll-offs.css"],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "socket": true,
  "authors": [{ "name": "Xandra" }],
  "url": "https://github.com/aestrro/fvtt-xandra-mods",
  "manifest": "https://github.com/aestrro/fvtt-xandra-mods/releases/latest/download/module.json",
  "download": "https://github.com/aestrro/fvtt-xandra-mods/releases/latest/download/xandra-roll-offs.zip",
  "license": "LICENSE.txt"
}
```

---

## 10. File/Folder Structure

```
modules/xandra-roll-offs/
  module.json
  LICENSE.txt
  lang/
    en.json
  styles/
    xandra-roll-offs.css
  scripts/
    main.js                 # init/ready hooks, registers everything below
    settings.js             # game.settings.register calls, get/set helpers
    socket.js               # RollOffSocketHandler class
    state.js                # pure resolution logic from §7 (unit-testable, no Foundry deps)
    chat.js                 # helpers for posting round/tiebreak/summary chat cards
    apps/
      GMPanelApp.js         # ApplicationV2 — GM control + live standings
      PlayerPromptApp.js    # ApplicationV2 (or lightweight chat-card button) — player roll trigger
  templates/
    gm-panel.hbs
    player-prompt.hbs
    chat-round-summary.hbs
    chat-rolloff-summary.hbs
```

Keep `state.js` free of any `game.*`/`foundry.*` calls so the core resolution algorithm (§7) can be unit tested with plain JS test data.

---

## 11. UI Specification

### 11.1 GM Panel (`ApplicationV2` + `HandlebarsApplicationMixin`)

**Configure state (no active roll-off):**

- Die type input (dropdown or free text: `1d20`, `1d100`, `2d6`, custom)
- Number of rounds (number input, min 1)
- Participant multi-select (default: all connected users, including the GM; GM can remove/include users)
- "Start Roll-Off" button (disabled if fewer than 2 participants)

**Active state:**

- Current round label (e.g. "Round 2", "Round 2 - Tiebreak")
- Live list of participants for the current round/tiebreak, each showing: not rolled / rolled (value shown to GM immediately, before resolution, is fine — GM transparency is acceptable; consider hiding values from _players_ until resolution)
- "Force Resolve" (manual override, optional convenience)
- "Cancel Roll-Off" button
- Leaderboard panel: live win tallies, all users, sorted descending
- "Reset Tallies" button (confirmation dialog required)

### 11.2 Player Prompt

Simplest reliable option: a **chat message with an embedded button**, rather than a standalone always-open Application — lower friction, appears exactly when needed.

- When `roundStarted`/`tiebreakStarted` fires and the current user is in `participants`, post (or update) a targeted chat card to that user: round label, die type, a "Roll" button.
- On click: disable the button, send `submitRoll`, show "Waiting for other players…" until `stateUpdated`/round resolution arrives.
- If the participant prefers, they may instead type a standard Foundry `/roll` command (e.g. `/roll 1d20`). The module must detect `/roll` chat messages whose expression matches the configured `dieType` for the current active round/tiebreak, treat them as a `submitRoll` for that user, and suppress the default chat card to avoid duplicate rolls. If the expression does not match, the module ignores it and Foundry posts the roll normally.

### 11.3 Chat Cards

- Per-roll: standard `Roll#toMessage()` output (flavor text: `"{user} rolls for {roundLabel}"`).
- Per-round-resolution: custom card via `chat-round-summary.hbs` — shows all rolls in that round side by side, declares winner, notes if a tiebreak is about to start.
- Per-roll-off-end: custom card via `chat-rolloff-summary.hbs` — full round-by-round winner list and final tallies.

---

## 12. Edge Cases & Handling

| Case                                         | Handling                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A participant disconnects mid-round          | Round cannot auto-resolve until they roll. GM gets a "Force Resolve" override to exclude/skip them (document this as a deliberate manual GM action, not automatic).                                                                                           |
| GM disconnects mid-roll-off                  | State is persisted in world settings; on GM reconnect, panel rehydrates from `activeRollOff` and continues normally. No auto-resolution happens while no GM is present.                                                                                       |
| Multiple GMs connected                       | Only one should act as socket authority to avoid double-processing. Simplest v1 rule: the GM whose client has the panel open and clicks "Start" becomes authority for that session; document this as a known limitation rather than building leader-election. |
| Participant tries to roll twice              | Reject client-side (button disabled after submit) **and** server-side (GM handler ignores a duplicate `submitRoll` or duplicate `/roll` match for a user who already has an entry in the current round's `rolls`).                                              |
| Participant list is empty or has 1 user      | Reject "Start Roll-Off" client-side with a validation message — a roll-off needs ≥2 participants.                                                                                                                                                             |
| Non-participant tries to submit a roll       | GM handler validates `userId` is in the current round's `participants` list before evaluating; ignore otherwise.                                                                                                                                              |
| `/roll` expression does not match dieType    | Ignored by the module; Foundry posts the roll normally. Only matching rolls count as a roll-off submission.                                                                                                                                                   |
| Tie among ALL participants repeatedly        | Naturally handled — recursion has no artificial depth limit, though consider a sane cap (e.g. 10 nested tiebreaks) with a GM warning/manual-resolve fallback, purely as a safety valve against pathological infinite ties on a coin-flip die.                 |

---

## 13. Testing Checklist

- [ ] Unit tests for `resolveRound()` (§7) — clean winner, 2-way tie, N-way tie, all-tie.
- [ ] Integration: start roll-off with 3 rounds, 3 participants (including GM), no ties — confirm 3 tally increments, correct history.
- [ ] Integration: force a tie (mock `Roll.evaluate`) — confirm tiebreak round spawns with only tied participants, original round doesn't tally until tiebreak resolves.
- [ ] Integration: nested tie (tiebreak ties again) — confirm second-level tiebreak spawns correctly and resolves up through both levels.
- [ ] Duplicate roll submission from same user in same round is rejected (button and `/roll`).
- [ ] Non-participant submitting a roll is rejected/ignored.
- [ ] Matching `/roll` is accepted as a roll-off roll; non-matching `/roll` is ignored by the module.
- [ ] Tallies persist after a roll-off ends and a new one starts.
- [ ] "Reset Tallies" clears `winTallies` and updates GM leaderboard view live.
- [ ] Cancel mid-roll-off clears `activeRollOff.active` and notifies all clients.
- [ ] Works across at least one non-dnd5e system to confirm no system-specific coupling.

---

## 14. Explicitly Out of Scope for v1 (documented future extensions)

- Multiple concurrent roll-offs.
- Alternate resolution modes (lowest wins, closest-to-target).
- Automatic GM leader-election if multiple GMs are online.
- Per-roll-off (as opposed to lifetime) tally tracking/history export.
- Localization beyond English (structure supports it via `lang/en.json`, just not populated for other languages yet).

---

## 15. Summary of Agreed Design Decisions (for reference)

1. Single active roll-off at a time.
2. GM-authoritative roll evaluation via sockets — never trust client-submitted values.
3. Ties trigger recursive, scoped tiebreak rounds using the same die type, tracked via a `roundStack`.
4. Win tallies are persistent across sessions, stored separately from active roll-off state, reset only by explicit GM action.
5. Current Foundry API only: `foundry.dice.Roll`, `ApplicationV2` + `HandlebarsApplicationMixin`, namespaced `Hooks`, standard socket-handler pattern.
6. System-agnostic — no dependency on any specific game system's actor/sheet data.
7. The GM may participate as a roll-off participant.
8. Participants may use standard `/roll` commands, but only rolls matching the configured die type count as roll-off submissions.
