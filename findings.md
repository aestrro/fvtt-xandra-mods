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

## React Dice Tray Architecture Consultation

- The current dice tray is a 788-line single script combining settings, chat DOM injection, mutation observers, queue state, formula construction, rolling, calculator UI, and a legacy `Application` subclass.
- The existing module has no build script or automated tests, and its `package.json` version (`0.1.0`) is already out of sync with `module.json` (`0.1.34`).
- The repository release workflow already builds modules with a `build` script and packages `dist/` when it contains `module.json`, so a compiled React sibling fits the release model.
- CI currently runs module builds with `|| true`, which would hide React build failures and must be corrected before treating the new pipeline as authoritative.
- A React successor should be a separate module with independent IDs, globals, settings, selectors, and CSS. The legacy and React variants should remain installable side-by-side but mutually exclusive at runtime.
- Shared React/Foundry integration should be a build-time pnpm workspace package bundled into each consuming module, not another Foundry runtime module dependency.
- The shared package should own only proven integration seams: a React `ApplicationV2` adapter and a DOM mount-root registry. Dice queue rules, formulas, and UI remain owned by the dice-tray module.
- Locked direction: the user will disable the legacy module when testing or enabling the React variant; the first slice does not need a runtime conflict system.
- Locked direction: the adapter is a build-time pnpm workspace package and is bundled into each consuming module.
- Locked direction: phase one implements the inline tray only; the calculator follows after live tray acceptance.
- React module structure preference: feature/domain-oriented component folders, small SRP components, dedicated `constants/` and `utils/` directories, default exports at file boundaries, and barrel exports at domain/package boundaries.
- Barrel files should re-export defaults as named package/domain exports; internal files should import directly from siblings to avoid barrel-created dependency cycles.
- React components remain presentation-focused and receive state/callbacks through props; Foundry globals, hooks, DOM mounting, settings, and roll execution stay in the `foundry/` adapter layer.
- Structural correction: do not create a generic top-level `domains/` directory for Dice Tray X. Group distinct concerns inside the directory that owns them—for example `utils/dice/`, `utils/formula/`, `constants/module/`, and `constants/dice/`.
- Components should normally be component folders (`components/DiceTray/`, `components/DiceButton/`) containing the implementation and an `index.ts` barrel, rather than loose component files in a shared folder.
- Zustand is a strong fit for the inline tray because one vanilla store can synchronize multiple React roots created for expanded and collapsed chat surfaces.
- React Router is compatible but unnecessary for the phase-one tray. If a later calculator becomes multi-view, it should use memory routing rather than taking ownership of Foundry's browser URL.
- Structural correction: the previous revision over-nested each concern and stopped reading like a conventional React app. Keep the top-level app flat (`components`, `hooks`, `stores`, `constants`, `utils`, `foundry`, `types`, `styles`) and introduce concern subfolders only where multiple related files justify them.
- Component-folder convention correction: do not repeat a component name as both folder and file (`RollControls/RollControls.tsx`). The folder entry is the implementation (`RollControls/index.tsx`) and default-exports the component; the parent `components/index.ts` barrel re-exports it by name.
- Apply the same no-redundant-filename rule to single-concern folders where practical: `utils/formula/index.ts`, `foundry/executeRoll/index.ts`, and shared adapter folders can contain their implementation directly in `index.ts`/`index.tsx`.
- Locked folder-entry convention: component folders implement and default-export from `index.tsx`; non-JSX concern folders implement or barrel from `index.ts`; parent barrels re-export folder defaults as named exports.
- React component convention: all rendered React UI uses function components and hooks. The shared `ReactApplicationV2` class is only a Foundry-required infrastructure adapter and is not a React class component.
- Dice Tray X now uses React `19.3.0`, React DOM `19.3.0`, Zustand `5.0.15`, Vite `8.3.4`, and TypeScript `5.9.3`.
- The reusable package exports a generic `ReactMountRegistry` and a Foundry `ApplicationV2` class factory. DOM observers remain module-owned so the shared package does not encode dice-tray selectors or Foundry screen assumptions.
- Both expanded and collapsed chat roots receive the same vanilla Zustand store; mount integration tests verify synchronized state, visibility switching, anchor replacement, setting disablement, and cleanup.
- Vite library mode intentionally preserves whitespace in ES library output and produced an 870 KB React bundle. Switching Dice Tray X to a normal custom-input application build produced a 228 KB bundle (71.85 KB gzip).
- CI now builds and tests both `packages/*` and `modules/*`, resolves scoped package names from `package.json`, and no longer hides build failures with `|| true`.
- The packaged module was copied to the local Foundry data directory and host/container SHA-256 hashes matched for the manifest, JavaScript bundle, and stylesheet.
- Live UI acceptance was initially blocked at Foundry's authenticated join/setup screen; no credentials were requested or handled in chat.
- User completed live activation and confirmed Dice Tray X works well in Foundry.
- The seven dice selectors are now one accessible `role="group"` with a localized label and a connected segmented-control treatment: shared seams, only outer corner radii, and elevated hover/focus/selected states.
- Live design review captured the tray at roughly 283×96 px in the collapsed chat column. Its structure is sound, but tiny icons, nearly uniform dark surfaces, weak cell boundaries, an understated Roll action, and a small clear link make the interface read more like a disabled toolbar than a responsive dice instrument.
- The strongest redesign direction is a compact command deck: one elevated outer surface, larger icon-plus-label die segments, high-contrast inset count badges, a clearly primary Roll button, state-colored ADV/DIS controls, and a more discoverable compact Clear action. This can preserve behavior and remain within the current width without adding a header or formula preview.
- Implemented the compact command-deck direction without changing state or roll behavior: scoped visual tokens, elevated outer shell, larger die faces with persistent labels, inset count badges, stronger selected state, blue primary Roll action, semantic mode colors, and an icon-supported reset action.
- Preserved the seven-button segmented group and the existing narrow-width geometry; no header, formula preview, routing, or new interaction path was added.
- The DIS / Roll / ADV row should also read as one visual button group. It is a mixed-purpose group rather than an ARIA radio group: DIS and ADV select a mode while Roll executes the current formula. Keep single seams and outer-only radii, but preserve Roll as the visually dominant center segment.
- The strongest third-row feature is a flat numeric modifier control paired with reset: decrement, current modifier, increment, and Clear. It adds common tabletop utility without duplicating Foundry's roll-mode selector or introducing preset-management complexity.
- User preferred formula preview, Repeat Last, and Clear over the numeric modifier. All three fit at collapsed-chat width when the preview is the flexible segment and Repeat/Clear are compact icon buttons.
- Recommended third-row contract: preview the current formula with ellipsis and a full native tooltip; show a quiet empty-state label when nothing is queued; enable Repeat only after a successful roll; Repeat must not mutate the current queue; Clear resets the current queue/mode but retains last-roll history.
- Implemented the exact three-row contract. Last-roll state lives in the shared Zustand store, so expanded and collapsed roots expose the same Repeat action. Failed rolls do not replace history or clear the active selection.
- DIS / Roll / ADV now share one segmented surface with single seams and outer-only radii. The formula row uses a flexible monospace preview plus two fixed-width icon controls, preserving the collapsed-chat footprint.
- Foundry's global focused-button treatment was leaking an orange outer ring into the module controls. Scoped `:focus` rules now remove the platform outline/shadow, while `:focus-visible` uses an internal blue ring that cannot be clipped by segmented containers.
- Selected dice and active roll modes now use inset state rings instead of colored outer borders. This preserves a complete blue/green/red state edge even where grouped buttons intentionally remove shared borders.
- Production promotion must preserve the existing `xandra-dice-tray` module ID. Foundry uses that ID for installed-module identity and world activation, so releasing the React implementation under the old ID gives existing users a normal update instead of a second module.
- The appropriate release line is `xandra-dice-tray@v0.2.0`: the latest published tag is `v0.1.34`, and this is a pre-1.0 architectural rewrite with changed feature scope rather than a patch release.
- The legacy calculator is the only material parity decision. Shipping the inline React tray immediately removes the old calculator plus `enableCalculator` and `autoRoll`; waiting for a React calculator preserves full feature parity. The existing `showTray` client setting can migrate seamlessly because its module ID and key remain unchanged.
- Do not retain an archive copy of the legacy implementation in the working tree. Tag `xandra-dice-tray@v0.1.34` already preserves it; the production folder should have one implementation and the experimental `xandra-dice-tray-x` folder should be removed after promotion.
- User selected immediate `v0.2.0` promotion without calculator parity. The calculator, `enableCalculator`, and `autoRoll` are intentionally removed from the production feature set and should be called out in migration/release notes rather than carried forward as dead compatibility code.
- Production promotion is complete in the working tree: `modules/xandra-dice-tray/` now owns the React implementation, metadata and package versions are synchronized at `0.2.0`, localization uses `XANDRA_DICE_TRAY`, and the experimental source/data directories are absent.
- The packaged artifact contains only `xandra-dice-tray/{module.json,README.md,lang/en.json,scripts/main.js,styles/xandra-dice-tray.css}`. Host/container hashes match under the production module ID.

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