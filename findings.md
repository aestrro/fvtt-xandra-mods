# Findings & Decisions

## Requirements

- Bare template literals or unresolved template values must never be visible to users.
- Tie-breaker output must receive correct primitive display values.
- Fix the actual template context contract rather than masking the rendered output.

## Research Findings

- `chat-round-summary.hbs` branches on `winner`, while `chat.mjs` passed `winner: !isTiebreakNext && winnerUser`, which could pass a full Foundry User object rather than a boolean.
- `main.mjs` registered `mod2` and `join`, but templates also use `eq`; no `eq` helper was registered.
- Tie-break names are already converted to a string in `postRoundSummary`; the safer context contract is an explicit boolean `isWinner`, `winnerName`, and `tiedNames`.
- The relevant files are `modules/xandra-roll-offs/scripts/main.mjs`, `scripts/chat.mjs`, and `templates/chat-round-summary.hbs`.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Register an explicit strict `eq` Handlebars helper | Templates already use primitive comparisons; an explicit helper prevents runtime unresolved-helper failures. |
| Replace the object-valued `winner` branch context with boolean `isWinner` | A template branch should receive a boolean, not a Foundry document object. |
| Keep display names precomputed in `chat.mjs` | Templates should render prepared display data and never resolve user IDs or documents themselves. |
| Persist the latest 25 completed sessions in a world setting | Gives all clients the same authoritative history while preventing unbounded setting growth. |
| Keep session history in a separate view | Preserves the compact active roll-off workflow and makes historical browsing intentional. |
| Record ISO timestamps at session start/end and round resolution | ISO values are sortable, portable, and can be formatted for the viewer’s locale. |

## Runtime and History Repair Findings

- `postRoundStarted` referenced `participantNames` without defining it, causing the start flow to throw after active state was persisted but before state-update broadcasts completed.
- Completed tiebreaks were persisted under each top-level history entry as `tieRounds`, but the session-history context rendered only the top-level entries.
- One pure `flattenRoundHistory` helper now provides the authoritative top-level-plus-tiebreak ordering for both the active round history and completed-session history.
- The standalone `GMPanelApp` and rendered sidebar-tab content were not bootstrap entry points; the live UI is the single `RollOffWindow` plus a sidebar toggle button.

## Low-to-Mid Bug Audit

- Cancelling marks the active object inactive, emits `rollOffCancelled`, then emits `stateUpdated` with a still-nonempty object. The window close hook runs first, then the state hook sees existing data and reopens it.
- Optional chat/audit-card creation is awaited inside authoritative mutation paths. A chat failure can suppress state broadcasts, and force-resolve can abandon an in-memory partial mutation before persistence.
- Start validation checks only truthiness for `winsNeeded`; fractional or invalid numeric values reach `startRollOff`, which throws instead of producing a controlled notification.
- The chat-button setting directly changes display without reapplying GM/active-roll-off visibility, so a player can reveal a stale button while no contest is active.
- The sidebar setting targets an obsolete `.item[data-tab="roll-offs"]` selector instead of the injected `#xro-sidebar-tab-btn`, so toggling the setting does not control the live button.
- `/r` interception lacks a command boundary and can treat unrelated slash commands beginning with `/r` as malformed roll attempts.
- `submitRoll` declares optional `rollId` support but discards it when persisting the roll result.
- Tiebreak rounds use the label `Round N - Tiebreak`, while the chat parser expects `Tie-Break #N`; recursive tiebreak announcements therefore fall back to `#1`.
- Raw Foundry socket events do not provide a trustworthy sender identity in the current handler. Full anti-spoofing requires a separate socket-authority design and is not a low-hanging patch.

## Bug Hardening Decisions

- Cancellation now clears active state and per-contest tallies through the existing close path, so `stateUpdated` cannot reopen an inactive object.
- Authoritative state writes and broadcasts happen before optional chat effects. Chat failures are logged and no longer roll back or suppress contest progress.
- Force-resolve evaluates every pending roll before mutating state, then persists all accepted results before attempting audit cards.
- Start configuration is normalized and validated at the GM authority boundary: nonempty die, integer wins from 1 through 20, and at least two unique nonempty participant IDs.
- Injected chat/sidebar controls resynchronize through module hooks so setting changes use the same live injection path as render/state changes.
- `/roll` parsing is a pure helper with an explicit command boundary.
- Roll IDs are preserved in active, tiebreak, and completed history records.
- Tiebreak rounds carry a 1-based `tiebreakIndex`, making recursive labels and chat announcements deterministic.

## Verified Second-Pass Findings

- Completed-session history is rendered inside the `hasData` branch. After `Close Roll-Off` clears active state, the History control can toggle internal state but the template always renders the empty/setup view, so persisted history is inaccessible without a retained active/completed object.
- `rollForParticipant` is registered in ApplicationV2 `DEFAULT_OPTIONS.actions` and is also wired manually in `_onRender`. The same `data-action` click can therefore invoke two roll requests.
- `advanceRound` has no in-flight guard. Rapid repeated clicks can resolve the same complete round concurrently before the first settings write becomes visible, duplicating history/tallies.
- Socket request handlers are async but `_onSocketEvent` invokes them without awaiting or attaching rejection handling. Settings or roll failures outside local catches can become unhandled promise rejections.
- Remote socket broadcasts pass the flattened object including `type` into hooks, while local `_emit` calls pass only the payload. Hook consumers receive different shapes depending on which client emitted the event.
- The `createChatMessage` fallback captures any matching roll authored by the current participant, deletes it before requesting the authoritative roll, and can consume unrelated macro/system rolls or lose the original message when submission fails.
- CSS references `--xro-primary-soft` and `--xro-surface-raised`, but neither variable is defined. Affected history-control and session-row backgrounds fall back to transparent/invalid values.
- The window state hook reopens a manually closed active roll-off on the next `stateUpdated` event. State updates should rerender an open window, not override the user's close choice.
- The round stack is forced to the bottom on every render, interrupting users reading older rounds. The stack also uses a fixed `calc(100% - 9rem)` height instead of the existing flex ownership model.
- The GM roll-for overlay is revealed only on hover, leaving the button unavailable to keyboard users. The wins tracker uses a `display:none` checkbox toggle rather than an accessible disclosure control.

## Rejected Second-Pass Claims

- `tieHistory` is not lost on reload; it is a property of the persisted `activeRollOff` object and is written through `setActiveRollOff`.
- The singleton creation is synchronous and does not have an asynchronous check/create race.
- `_resolveRound` does not emit both terminal and nonterminal winner updates; the terminal path returns before the nonterminal emit.
- `_onRender` listeners are attached to replaced DOM nodes, so ordinary rerenders do not accumulate listeners on the current tree.
- The pre-resolution force-resolve write is intentionally recoverable state, not corruption; removing it would make failures more destructive.

## Second Correctness Tranche Decisions

- Session history is now the first template branch, independent of active-state data, so completed history remains available after closing a contest.
- ApplicationV2 `actions` is the sole handler for GM roll-for-participant buttons; the duplicate manual listener was removed.
- GM mutations now use focused in-flight guards: one round resolution/force-resolve at a time, one start at a time, and one roll evaluation per user at a time.
- Async socket request dispatch is contained through a rejection boundary that logs and surfaces failures instead of creating unhandled promises.
- Remote broadcasts strip the transport `type` field before firing hooks, matching local hook payloads.
- The chat-message fallback now acts only on a short-lived pending `/roll` intent. It never submits a second roll and leaves player messages intact when the raw socket has no acknowledgement.
- Ordinary state updates rerender an already-open window but do not reopen a window the user manually closed.
- Missing visual tokens `--xro-primary-soft` and `--xro-surface-raised` are now defined and covered by an asset-contract test.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| First patch used repository-root paths instead of module paths | No files were modified; corrected the patch to `modules/xandra-roll-offs/...`. |

## Resources

- `modules/xandra-roll-offs/scripts/main.mjs`
- `modules/xandra-roll-offs/scripts/chat.mjs`
- `modules/xandra-roll-offs/templates/chat-round-summary.hbs`
- `https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html`
- `https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html`

## Visual/Browser Findings

- None.

---

*Updated during the tie-breaker template-context fix.*