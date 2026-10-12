# Task Plan: Xandra Roll-Offs UI Refresh

## Goal

The roll-off module has a condensed, modern dark UI with clear hierarchy, scoped styling, and no regressions to its existing behavior.

## Next Step

Hard-refresh Foundry and manually verify history-without-active-state, duplicate-click guards, chat interception, and the full contest lifecycle.

## Current Phase

Phase 8 — Live Foundry Acceptance

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
