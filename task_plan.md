# Task Plan: Xandra Roll-Offs UI Refresh

## Goal

The roll-off module has a condensed, modern dark UI with clear hierarchy, scoped styling, and no regressions to its existing behavior.

## Next Step

Hard-refresh Foundry and manually verify history-without-active-state, duplicate-click guards, chat interception, and the full contest lifecycle.

## Current Phase

Phase 13 — Full Panel Surface and Compact Footer

## Phases

### Phase 1: Requirements & Discovery

- [x] Understand the requested visual direction
- [x] Inspect the current stylesheet and templates
- [x] Document the visual constraints in findings.md
- **Status:** complete

### Phase 2: Design & Structure

- [x] Define the compact dark visual system
- [x] Define scoped selectors and interaction states
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation

- [x] Rewrite the module stylesheet without changing behavior
- [x] Preserve condensed layouts and existing template hooks
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification

- [x] Verify all visual requirements in the live client
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery

- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

### Phase 6: Session History

- [x] Extend world settings with bounded completed-session history
- [x] Capture start/end timestamps and round/tiebreak data
- [x] Add a separate timestamped history view
- [x] Add state and persistence tests
- [x] Add a round-start chat regression test
- [x] Remove the legacy GM panel and duplicate sidebar content UI
- [ ] Verify live Docker-mounted Foundry behavior
- **Status:** in_progress

### Phase 7: Bug Hardening Audit

- [x] Trace obvious low-to-mid failure paths
- [x] Separate focused fixes from deeper socket-authority redesign
- [x] Confirm the implementation tranche
- [x] Add regression tests before production fixes
- [x] Implement and verify the approved fixes
- **Status:** complete

### Phase 8: Live Foundry Acceptance

- [ ] Hard-refresh the mounted Foundry client
- [ ] Exercise start, cancel, settings toggles, and force-resolve
- [ ] Exercise a recursive tiebreak and completed-session history
- **Status:** in_progress

### Phase 9: Second-Pass Hardening Audit

- [x] Run independent state, socket, and UI lifecycle audits
- [x] Verify findings against current source and Foundry v14 action behavior
- [x] Reject false positives and separate correctness from polish
- [x] Confirm the next implementation tranche
- [x] Add regression coverage and implement approved fixes
- **Status:** complete

### Phase 10: React Roll-Off Window Migration

- [x] Preserve `xandra-roll-offs` identity, settings, pure rules, GM socket authority, and chat interception
- [x] Replace the Handlebars window with a React ApplicationV2 window and focused function components
- [x] Build and package the module including chat templates, locale, and window styling
- [x] Add React window/component tests and adapt asset tests without weakening existing regressions
- [x] Run unit tests, typecheck, build, and packaged-asset checks
- [ ] Exercise live GM/player contest lifecycle in the authenticated Foundry client (browser session is at `/auth` with no saved login)
- **Status:** in_progress

### Phase 11: Dice-Tray Visual Language and Foundry Theme Support

- [x] Scope roll-off color tokens to its ApplicationV2 window and chat cards, with light/dark theme variants
- [x] Carry the dice tray's flat materials, single-seam controls, inset selection/focus states, and compact spacing across setup, rounds, history, tracker, footer, and chat cards
- [x] Verify contrast, asset/token coverage, typecheck, tests, build, packaged stylesheet, and served-file parity
- [x] Exercise light/dark theme tokens in a browser computed-style probe against the locally served Foundry stylesheet
- [ ] Inspect actual Roll-Offs ApplicationV2 window visually in an authenticated Foundry client
- **Status:** in_progress

### Parallel Initiative: Xandra Dice Tray X

- [x] Audit inline behavior in the legacy dice tray
- [x] Lock the React application structure and export conventions
- [x] Add the shared `@xandra/foundry-react` workspace package
- [x] Implement React 19 function components and a shared Zustand store
- [x] Implement leak-free expanded/collapsed chat mounting
- [x] Add pure, component, Foundry-adapter, and lifecycle tests
- [x] Produce and install the packaged module in the local Foundry data directory
- [x] Enable Dice Tray X, disable the legacy tray, and complete live client acceptance
- [x] Present the dice selectors as one semantic and visual button group
- [x] Implement the compact command-deck UI/UX design pass
- [x] Group DIS / Roll / ADV and add formula preview, Repeat Last, and Clear
- [x] Complete live visual acceptance of the redesigned tray
- [x] Decide whether production promotion waits for React calculator parity — ship now without calculator
- [x] Promote Dice Tray X into the `xandra-dice-tray` identity and remove the experiment
- **Status:** complete — production source is ready for commit and release approval

## Locked Decision

World-persisted history, latest 25 sessions, visible to participants, with a separate history toggle/view and timestamps in session and round displays.

## Key Questions

1. Does the UI remain compact at the current 420x560 window size? **To verify in browser.**
2. Are all selectors scoped to the module? **Yes, except the existing sidebar active-state selector.**
3. Does the visual pass change behavior? **No intended behavior changes.**

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Rewrite the module CSS rather than append overrides | The existing stylesheet had accumulated conflicting rules; a clean source of truth is easier to maintain. |
| Use a dark layered surface system with blue/green/gold semantic accents | Gives the compact UI hierarchy without heavy borders or visual noise. |
| Keep the current template structure and action hooks | Avoids unnecessary behavioral risk while improving the existing surfaces. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Plan patch matched duplicate phase markers | 1 | Re-read the current plan and rewrote it with the UI-refresh phases. |

### Phase 12: Publish Xandra Roll-Offs 0.2.1

- [x] Synchronize module/package version and download URL at 0.2.1
- [x] Run module tests, typecheck, production build, package manifest/asset and CRC checks
- [x] Commit the tested module state, tag `xandra-roll-offs@v0.2.1`, and push
- [x] Verify release workflow and published `module.zip`
- [ ] Complete authenticated live Foundry acceptance (separate outstanding gate)
- **Status:** complete — release workflow succeeded and the published archive was downloaded and verified

### Phase 13: Full Panel Surface and Compact Footer

- [x] Make the grey surface cover the contest panel, with the round history transparent inside it
- [x] Condense the wins tracker into a one-row closed summary; preserve the full participant breakdown when expanded
- [x] Group completed-contest actions into a single compact footer row
- [x] Verify module tests, typecheck, build, CSS contract checks, and Foundry bind-mounted asset parity
- [ ] Hard-refresh and visually review in Foundry
- **Status:** in_progress — implementation and automated/build verification pass; live client review remains

### Phase 14: Wins Summary and Component Scope

- [x] Keep the last-roll repeat control out of Roll-Offs; it belongs to Dice Tray
- [x] Keep collapsed Wins to one row: current player name, dots, and expand/collapse toggle; no dropdown
- [x] Expand Wins to show all character win rows
- [x] Remove the player dropdown; retain the right-side expand/collapse toggle
- [x] Verify tests, typecheck, build, and diff hygiene for v0.2.2
- [x] Apply the Foundry window shell radius and theme background tokens
- [x] Verify asset tests, typecheck, build, and Docker CSS parity for the shell styling follow-up
- [x] Remove the inner window-content border, top radius, and background
- [x] Verify the shell cleanup with regression tests and the full module checks
- [x] Remove banner top border and add bottom spacing below banners
- [x] Square top corners on shared surface banners while retaining the bottom radius
- [ ] Hard-refresh and visually review the tracker in Foundry
- **Status:** in_progress — implementation and automated checks pass; live visual acceptance remains
