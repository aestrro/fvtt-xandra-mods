# `xandra-roll-offs` Architecture

This document describes the implementation currently in `modules/xandra-roll-offs/`.

## Runtime topology

```text
Foundry client
└── scripts/main.mjs
    ├── settings.mjs       persistence and settings keys
    ├── socket.mjs          GM authority and broadcasts
    ├── state.mjs           pure roll-off state machine
    ├── chat.mjs            audit and summary messages
    ├── apps/RollOffWindow.mjs
    ├── apps/RollOffSidebarTab.mjs
    └── utils.mjs           module identity and actor helpers
```

The dependency direction is deliberate:

- `state.mjs` has no Foundry dependency.
- `settings.mjs` owns settings registration and accessors.
- `socket.mjs` owns authority, persistence orchestration, and network events.
- application classes prepare display context and dispatch user intent.
- `main.mjs` wires lifecycle hooks and global integration points.

## State machine

`state.mjs` models an active roll-off as plain data:

```js
{
  active: true,
  dieType: '1d20',
  winsNeeded: 2,
  currentRoundIndex: 0,
  participants: ['user-a', 'user-b'],
  roundStack: [/* active root or tiebreak round */],
  history: [/* resolved top-level rounds */]
}
```

Only the final item in `roundStack` is active. A tiebreak is pushed with only the tied participants. When a tiebreak resolves, the root round is recorded in history and the stack is reset for the next top-level round.

### Core invariants

1. A roll-off must have at least two participants.
2. A participant can submit at most one roll in an active round.
3. A non-participant cannot submit a roll.
4. A roll is accepted only when its `total` is numeric.
5. A tie does not increment a tally until its tiebreak chain produces one winner.
6. The state engine performs no Foundry I/O.

## Authority and security boundary

The client that owns GM authority evaluates dice. A player sends intent only:

```text
player: submitRoll { userId }
GM: construct and evaluate Roll(dieType)
GM: persist total and broadcast state
all clients: render state
```

The GM never trusts a numeric result supplied by a player. The socket handler validates that the requested user can roll against the current state before constructing the roll.

This is the module's most important security boundary. Client-side button disabling is UX; server-side/GM-side validation is enforcement.

## Socket protocol

Namespace:

```text
module.xandra-roll-offs
```

The current event types are:

| Event | Direction | Meaning |
|---|---|---|
| `submitRoll` | player or GM → GM handler | Request a roll for a validated participant. |
| `requestStartRollOff` | UI → GM handler | Request a new configured roll-off. |
| `stateUpdated` | GM → all clients | State changed; refresh UI. |
| `roundStarted` | GM → all clients | New top-level round began. |
| `tiebreakStarted` | GM → all clients | Tiebreak began for tied participants. |
| `rollOffEnded` | GM → all clients | Final winner and tallies are available. |
| `rollOffCancelled` | GM → all clients | Roll-off state was cleared or cancelled. |

Payloads are flattened rather than nested under a `payload` property. The sender also calls the local hook because Foundry socket emission does not echo the event to the sending client.

## Persistence

The world settings are:

- `xandra-roll-offs.activeRollOff`
- `xandra-roll-offs.winTallies`

The active state is persisted after accepted rolls and transitions. Tallies are reset when a new roll-off starts in the current implementation, so they represent the current contest rather than lifetime totals. That behavior is the source of truth for the current code and differs from the older specification's “persist across sessions” wording.

## Application surfaces

### `RollOffWindow`

The main ApplicationV2 theatre window is a singleton. It displays:

- current round and participant status;
- round history;
- participant win tracker;
- player roll action;
- GM start, advance, force-resolve, cancel, and close controls;
- GM roll-for-participant controls.

Its context is derived from settings and the pure state helpers. The window remains available after a roll-off ends so the final state can be displayed until the GM explicitly closes it.

### `RollOffSidebarTab`

The sidebar integration is a lightweight launcher. It extends `AbstractSidebarTab`, uses the v14 namespace, and opens the dedicated window rather than duplicating the full feature surface.

The navigation button is injected into the v14 sidebar menu as a `<li>` containing a native-looking `<button>`. It intentionally does not use `data-tab` or Foundry's tab action because its purpose is to toggle the dedicated window, not to activate a second panel.

### Chat controls

`main.mjs` injects a module button into `#chat-controls` on `renderChatLog`. The button is visible to the GM and to players while a roll-off is active. The target is a stable global integration point; the button does not depend on positional selectors.

## Chat pipeline

There are two paths for participant rolls:

1. `chatMessage` synchronously intercepts matching `/roll` commands and suppresses the normal chat message.
2. `createChatMessage` is a fallback for system or module paths that bypass the first hook.

Audit rolls are marked with:

```js
flags: {
  'xandra-roll-offs': {
    auditRoll: true,
  },
}
```

The fallback ignores those messages to prevent an audit roll from being captured as a second participant request.

## UI state synchronization

The GM persists state, emits socket events, and calls module-local hooks. Every client reacts to the local hook and rehydrates from its own world setting view. This avoids making UI state depend on a socket payload arriving in a particular order.

The important event chain is:

```text
GM mutation
→ game.settings.set
→ socket broadcast
→ Hooks.callAll('xandraRollOffs.stateUpdated', state)
→ application re-render/open/close
```

## Known implementation boundaries

- There is one active roll-off at a time.
- There is no automatic GM leader election.
- A disconnected participant requires GM intervention through force resolve.
- State authority depends on an active GM client.
- The live implementation resets tallies on roll-off start, despite the older specification describing cross-session persistence.

These are design boundaries, not accidental guarantees. Changes that alter them should update state logic, socket behavior, UI context, tests, and documentation together.
