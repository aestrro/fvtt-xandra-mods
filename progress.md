# Progress Log

## Session: 2026-09-19

### Phase 1: Requirements & Discovery

- **Status:** complete
- **Started:** 2026-09-19
- Actions taken:
  - Inspected all roll-off Handlebars templates.
  - Traced tie-break summary data from `socket.mjs` through `chat.mjs` into `chat-round-summary.hbs`.
  - Found an object-valued conditional and an unregistered `eq` helper.
- Files created/modified:
  - `findings.md`
  - `task_plan.md`

### Phase 2: Planning & Structure

- **Status:** complete
- Actions taken:
  - Chose a typed display-context fix: strict boolean branch plus precomputed names.
  - Kept document/user resolution out of templates.
- Files created/modified:
  - `findings.md`
  - `task_plan.md`

### Phase 3: Implementation

- **Status:** complete
- Actions taken:
  - Registered a strict `eq` Handlebars helper in `main.mjs`.
  - Changed the round-summary context to pass `isWinner` as a boolean.
  - Updated the tie-break summary template to branch on `isWinner`.
- Files created/modified:
  - `modules/xandra-roll-offs/scripts/main.mjs`
  - `modules/xandra-roll-offs/scripts/chat.mjs`
  - `modules/xandra-roll-offs/templates/chat-round-summary.hbs`

### Phase 4: Testing & Verification

- **Status:** complete
- Actions taken:
  - Ran the module test suite.
  - Ran JavaScript syntax checks.
  - Searched templates for all `eq` usages and winner/tie branches.
  - Ran `git diff --check`.
- Files created/modified:
  - `progress.md`

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Roll-off unit suite | `pnpm test:roll-offs` | All tests pass | 20 passed, 0 failed | PASS |
| JavaScript syntax | `node --check` on changed and related scripts | No syntax errors | `syntax ok` | PASS |
| Template helper inventory | Search all `.hbs` for `eq` | Every use has a registered helper | 3 templates use `eq`; helper registered | PASS |
| Diff whitespace | `git diff --check` | No whitespace errors | Passed | PASS |
| Docker bind mount | `docker inspect Fvtt` | Local module checkout mounted into Foundry Data/modules | `K:/aestrro/fvtt-xandra-mods/modules/xandra-roll-offs -> /home/foundry/fvttdata/Data/modules/xandra-roll-offs` | PASS |
| Live file parity | `sha256sum` host/container | Container files match source checkout | All three changed files matched byte-for-byte | PASS |
| Compose validation | `docker compose config --quiet` | Compose configuration valid | Passed | PASS |
| Foundry reload | `docker restart Fvtt` and logs | Foundry restarts on v14.360 | `Foundry Virtual Tabletop - Version 14 Build 360` | PASS |
| Live tie-breaker observation | Foundry chat card | No unresolved localization placeholders | Observed `TIE BETWEEN {NAMES}` | FAIL — fixed by preparing `resultText` in JavaScript |
| Live window tie label trace | `roll-off-window.hbs` and `RollOffWindow._prepareContext` | Tie label has no placeholder and names are prepared | Found `Labels.Tie` still contained `{names}` and `roundResult.names` was joined in template | FIXED — static locale label plus `roundResult.tieNames` |
| Force-resolve code trace | `socket.mjs:124-142` | Missing participants are resolved authoritatively | Existing code removed pending participants, leaving invalid round state | FIXED — GM rolls for every pending participant |
| Reload requirement clarified | Bind-mounted module | Browser refresh is sufficient for loaded client assets after source update | Full container restart is not required for normal `.mjs`/`.hbs`/locale edits; restart was used for conservative reload verification | PASS |
| UI stylesheet rewrite | `styles/xandra-roll-offs.css` | Condensed, modern dark UI with scoped selectors and preserved action hooks | Replaced accumulated styling with a single layered surface system, compact controls, stronger hierarchy, and responsive interaction states | PASS |
| UI validation | `pnpm test:roll-offs`, `node --check`, locale parse, `git diff --check`, host/container CSS hashes | No behavior or asset parity regressions | 21 tests passed; syntax and locale valid; CSS hashes match | PASS |
| Single-line round navigation | `roll-off-window.hbs`, `RollOffWindow._onRender`, scoped CSS | Round rows never wrap and can be browsed when narrow | Added horizontal overflow rows with conditional left/right chevrons and smooth seek behavior | IMPLEMENTED — validation pending |
| Surface flattening | Scoped stylesheet | Remove decorative outer containers while retaining functional scroll/footer structure | Flattened round groups, tracker, and action footer into one continuous surface with minimal separators | IMPLEMENTED — validation pending |
| Surface rollback and row centering | Scoped stylesheet | Restore previous containers and center visible round items | Reverted only the flattening rules; retained horizontal overflow/chevrons and restored centered rows | IMPLEMENTED — validation pending |
| Visible row navigation | Scoped stylesheet | Make horizontal seeking discoverable at all widths | Arrows were hidden until JS measured overflow; made both chevrons always visible and established a definite row viewport | IMPLEMENTED — validation pending |
| Centered row navigation | Scoped stylesheet | Keep round items centered and chevrons vertically centered | Restored centered row alignment, gave the scroller full width, and centered arrows against the row height | IMPLEMENTED — validation pending |
| Row gap removal | Scoped stylesheet | Remove vertical gaps between round rows | Removed the scroll-stack gap and inter-row margin while keeping compact internal row spacing | IMPLEMENTED — validation pending |
| Square round surfaces | Scoped stylesheet | Remove unnecessary rounding from continuous round/footer surfaces | Set round groups, tracker, and footer containers to square corners while preserving pill-shaped controls and participant value badges | IMPLEMENTED — validation pending |
| Rounded row containers | Scoped stylesheet | Contain every round row in a rounded, lightly stroked surface | Added a rounded border, subtle stroke, current-round accent, and overflow clipping to each round group | IMPLEMENTED — validation pending |
| Single round-stack container | Scoped stylesheet | Put all round rows inside one rounded, lightly stroked container | Removed per-round borders/radii and applied the containing surface to `.xro-scroll-stack` | IMPLEMENTED — validation pending |
| Border refinement | Scoped stylesheet | Avoid double borders and lighten the shared outer stroke | Removed current-row inset stroke and changed the stack border to a lighter single stroke | IMPLEMENTED — validation pending |
| Panel background alignment | Scoped stylesheet | Match the darker alternating row to the panel background | Replaced the darker row overlay with `var(--xro-bg-1)` | IMPLEMENTED — validation pending |
| Outer border softening | Scoped stylesheet | Reduce the visual weight of the shared round-stack border | Lowered the outer stroke from 20% to 11% white opacity | IMPLEMENTED — validation pending |
| Vertical round scrolling | Scoped stylesheet | Allow the shared round stack to occupy and scroll its available height | Added `flex: 1 1 auto` and `min-height: 0` so the stack can shrink inside the window and overflow vertically | IMPLEMENTED — validation pending |
| Vertical scroll sizing correction | Scoped stylesheet | Force the list viewport to shrink rather than expand with round content | Added flex sizing to `.xro-window-body` and `height: 0` to the primary stack flex child | IMPLEMENTED — validation pending |
| Vertical scroll sizing revision | Scoped stylesheet | Remove brittle zero-height sizing from the AppV2 list viewport | Replaced forced `height: 0`/`height: 100%` with auto height plus shrinkable flex sizing | IMPLEMENTED — validation pending |
| Grid list viewport | Scoped stylesheet | Constrain the round list independently of AppV2 flex sizing | Changed the populated window body to a three-row CSS grid with the round stack in `minmax(0, 1fr)` | IMPLEMENTED — validation pending |
| Explicit list viewport | Scoped stylesheet | Make the stack itself the guaranteed vertical scroll owner | Reverted the ineffective grid sizing, assigned the stack a constrained `calc(100% - 9rem)` viewport, and removed the bottom spacer that consumed the scroll track | IMPLEMENTED — validation pending |
| Inner scroll content wrapper | `roll-off-window.hbs` and scoped CSS | Separate the scroll viewport from the bottom-anchored content layout | Added `.xro-scroll-stack-content` inside the overflow owner; the outer stack now scrolls while the inner content handles alignment | IMPLEMENTED — validation pending |
| Final live DOM verification | Supplied live Foundry DOM | Confirm the intended ownership structure is present | DOM contains `.xro-scroll-stack` wrapping `.xro-scroll-stack-content`; host/container hashes match and 21 tests pass | PASS |
| Flat bottom actions | Scoped stylesheet | Remove the decorative container around Next Round and bottom GM actions | Flattened `.xro-footer` while preserving its anchored layout and action controls | IMPLEMENTED — validation pending |
| Joined wins surface | Scoped stylesheet | Visually connect the wins tracker to the bottom of the round stack | Removed the shared seam, overlapped the tracker by the panel gap, and assigned complementary top/bottom radii | IMPLEMENTED — validation pending |
| Restore full stack radius | Scoped stylesheet | Preserve the rounded corners of the shared round stack | Restored the stack’s full border and radius; removed the tracker overlap so neither container masks the other | IMPLEMENTED — validation pending |
| Remove tracker parent rounding | Scoped stylesheet | Remove the bottom rounding from the wins/stack parent controller | Set the wins tracker container to square corners while retaining the joined seam and stack top corners | IMPLEMENTED — validation pending |
| Explicit stack corner mapping | Scoped stylesheet | Ensure the stack rounds only its top corners | Confirmed `.xro-scroll-stack` uses `var(--xro-radius) var(--xro-radius) 0 0` | PASS |
| Floating row navigation | Scoped stylesheet | Let round rows use the full container width while keeping chevrons overlaid | Moved chevrons to absolute floating controls and made the row occupy the full scroller width | IMPLEMENTED — validation pending |
| CSS rule consolidation | Scoped stylesheet | Keep the stack corner and overflow contract unambiguous after iterative styling | Consolidated duplicate stack rules and removed the stale commented rule; stack now explicitly owns top corners only | IMPLEMENTED — validation pending |
| Chat card low-hanging improvements | Scoped stylesheet | Improve scanability without changing chat-card data or behavior | Added numeric badges, winner/tiebreak markers, and a subtle standings divider | IMPLEMENTED — validation pending |
| Wider character rows | Scoped stylesheet | Give character names more room and increase each character tile by 20px | Increased `.xro-roll-pill` from 62px to 82px and names from 0.62rem to 0.72rem | IMPLEMENTED — validation pending |
| Round title and narrow scroller refinement | Scoped stylesheet | Improve title hierarchy and prevent narrow overflow from centering awkwardly | Enlarged and spaced round titles; rows now left-anchor when overflowing and center only when content fits via auto side margins | IMPLEMENTED — validation pending |
| Centered round titles | Scoped stylesheet | Keep title alignment consistent with the centered row composition | Restored centered title alignment while retaining the improved size and margins | IMPLEMENTED — validation pending |
| Current-round result surface | `roll-off-window.hbs` and scoped CSS | Keep the current round outside history and decorate its completed result in the same fixed position | Moved current-round markup out of the scroll stack and added a winner/tiebreak result panel above wins | IMPLEMENTED — validation pending |
| Result neighbor spacing | Scoped stylesheet | Keep rounded result, stack, and wins surfaces from visually colliding | Added horizontal inset to the result panel and explicit spacing before the tracker | IMPLEMENTED — validation pending |
| Connected result composition | Scoped stylesheet | Make the completed-result panel feel part of the stack/tracker surface | Removed inset/gap, matched the shared surface/border language, and removed the tracker’s joining top edge | IMPLEMENTED — validation pending |
| Flat connected result panel | Scoped stylesheet | Remove remaining visual separation from the completed-result zone | Removed result-panel rounding and retained zero outer margin so it joins the neighboring surfaces | IMPLEMENTED — validation pending |
| Remove inter-zone gaps | Scoped stylesheet | Eliminate the visible gaps above and below the result zone | Removed the populated window body flex gap and suppressed the tracker header top edge when following the result panel | IMPLEMENTED — validation pending |
| Unified result borders | Scoped stylesheet | Keep result-panel borders consistent with the rest of the module | Removed winner/tie-specific border colors; result panels now use the shared `var(--xro-line)` stroke | IMPLEMENTED — validation pending |
| Tiebreak history rows | `RollOffWindow._prepareContext` | Show each tiebreak as its own round line in the history stack | Added display entries for active round-stack entries with a parent round, including their rolls and a `Tiebreak` label | IMPLEMENTED — validation pending |
| Tie numbering | `RollOffWindow._prepareContext` | Label tie history rows as `Tie #1`, `Tie #2`, etc. | Changed the history label from generic `Tiebreak` to numbered tie labels | IMPLEMENTED — validation pending |
| Persist tie history | `state.mjs`, `RollOffWindow.mjs` | Preserve resolved tiebreak rolls so completed ties remain visible in history | Stored tie-round snapshots in history and render them as numbered rows | IMPLEMENTED — validation pending |
| Fix tie duplication and persistence | `state.mjs`, `RollOffWindow.mjs` | Prevent live tiebreak rows from being mixed with persisted rows and retain them after resolution | Persist snapshots at final resolution, render persisted rows only, and test the full tie-to-history path | IMPLEMENTED — validation pending |
| Tie persistence root cause | `state.mjs` | Capture tiebreak rolls before `roundStack` is cleared and avoid rendering a stale live copy | Added a transient tie-history buffer updated by `submitRoll`, copied into final history, then cleared | IMPLEMENTED — validation pending |
| Duplicate opening round headers | `RollOffWindow._prepareContext` | Keep the initial regular round and tie round visually distinct | Changed persisted transient tie rows to use a `Tie #N` label rather than another `Round N` label | IMPLEMENTED — validation pending |
| Duplicate tie history rows | `RollOffWindow._prepareContext` | Render each tiebreak from one authoritative source | Removed live `roundStack` and transient `tieHistory` rendering; completed ties now come only from persisted `history[].tieRounds` | IMPLEMENTED — validation pending |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-09-19 | Patch used root-level module paths | 1 | Corrected to `modules/xandra-roll-offs/...`; no files changed by failed attempt. |
| 2026-09-19 | Plan patch matched duplicate `Phase 1` text | 1 | Rewrote the verified plan file. |
| 2026-09-19 | Progress write was blocked by stale-read protection | 1 | Re-read the current file, merged the update, and wrote it successfully. |
| 2026-09-19 | Live browser tie-breaker card not yet manually exercised | 1 | Foundry container restarted successfully; browser acceptance remains the next step. |
| 2026-09-19 | Tie-breaker chat card rendered `TIE BETWEEN {NAMES}` | 1 | Moved interpolation into `postRoundSummary` and render the prepared `resultText` value. |
| 2026-09-19 | `XANDRA_ROLL_OFFS.Labels.Tie` still contained `{names}` | 1 | Changed locale value to `Tie between` and prepared `tieNames` in `RollOffWindow`. |
| 2026-09-19 | Force Resolve removed pending participants instead of resolving them | 1 | Changed action to GM-evaluate rolls for pending users and then resolve the complete round. |
| 2026-09-19 | Reload guidance was overly conservative | 1 | Clarified that a hard browser refresh is normally sufficient with the live bind mount; restart is only needed for server/container or cache issues. |
| 2026-09-19 | Existing stylesheet had accumulated conflicting rules | 1 | Rewrote the module stylesheet as one scoped source of truth; no templates or behavior changed. |
| 2026-09-19 | Round rows wrapped when the window narrowed | 1 | Replaced wrapping with single-line horizontal scrolling and accessible chevron controls. |
| 2026-09-19 | Decorative outer containers made the UI feel boxed-in | 1 | Removed outer fills, borders, radii, and shadows from round groups/tracker/footer while preserving functional boundaries. |
| 2026-09-19 | Surface flattening was not desired and rows hugged the left edge | 1 | Restored the prior container styling and changed fitting rows back to centered alignment while retaining horizontal seeking. |
| 2026-09-19 | Chevron controls were invisible until overflow measurement completed | 1 | Made chevrons persistent and gave the row a definite flex viewport so left/right seeking is always discoverable. |
| 2026-09-19 | Centering regressed while making arrows visible | 1 | Restored centered row composition and vertically centered the chevrons with `align-self: center`. |
| 2026-09-19 | Vertical gaps remained between round rows | 1 | Removed the stack gap and inter-group margin; retained only minimal internal title/row spacing. |
| 2026-09-19 | Continuous surfaces still had decorative rounded corners | 1 | Removed radius from round groups, tracker, and footer; retained rounding only on interactive controls and badges. |
| 2026-09-19 | Round rows needed a clear containing surface | 1 | Added rounded containers with a light stroke around each complete round row. |
| 2026-09-19 | Per-row containers did not match the requested composition | 1 | Reverted per-row borders/radii and moved the rounded light-stroke container to the shared round stack. |
| 2026-09-19 | Current row still produced a doubled border and outer stroke was too dark | 1 | Removed the current-row inset border and lightened the shared stack border. |
| 2026-09-19 | Dark alternating row contrasted against the panel | 1 | Matched `.xro-round-group--alt` to the panel background variable. |
| 2026-09-19 | Shared container border was too strong | 1 | Reduced the border opacity to a quiet 11% white stroke. |
| 2026-09-19 | Round stack could grow instead of becoming a vertical scroll viewport | 1 | Added flex growth and `min-height: 0` to the shared stack. |
| 2026-09-19 | Stack still expanded in the rendered list view | 1 | Added the missing parent flex sizing and zero-height flex basis so overflow is enforced. |
| 2026-09-19 | Zero-height flex sizing still did not produce the expected live scroll viewport | 1 | Removed the forced zero-height basis and let AppV2 provide the available height through auto-sized shrinkable flex children. |
| 2026-09-19 | Pasted live DOM still showed the round stack expanding instead of scrolling | 1 | Replaced the nested flex sizing with a constrained CSS grid viewport for the populated window body. |
| 2026-09-19 | Second live DOM still showed the stack content-sized | 1 | Made the stack the explicit scroll viewport and removed the flex spacer pseudo-element. |
| 2026-09-19 | Stack still did not behave as a reliable overflow owner | 1 | Added a dedicated inner content wrapper so scrolling and bottom alignment no longer compete on the same element. |
| 2026-09-19 | Bottom action footer still appeared as a boxed container | 1 | Removed the footer border, background, radius inheritance, and shadow while preserving button layout. |
| 2026-09-19 | Wins tracker read as a separate container from the round stack | 1 | Joined the stack and tracker by removing the seam, overlapping the gap, and using complementary radii. |
| 2026-09-19 | Tracker join masked the stack’s bottom rounded corners | 1 | Restored the intended joined treatment: stack keeps only top corners, tracker keeps only bottom corners, with no seam between them. |
| 2026-09-19 | Wins tracker parent still had bottom rounding | 1 | Removed the tracker container’s bottom radius while preserving the joined stack treatment. |
| 2026-09-19 | Row chevrons consumed horizontal space | 1 | Changed navigation buttons to floating absolute controls so participant rows can use the full width. |
| 2026-09-19 | Iterative styling left duplicate stack rules and ambiguous corner declarations | 1 | Consolidated `.xro-scroll-stack` into one explicit rule with top-only radius and overflow ownership. |
| 2026-09-19 | Chat cards were visually dense and lists had weak hierarchy | 1 | Added compact numeric badges, semantic result markers, and a standings separation rule. |
| 2026-09-19 | Character names were too small and tiles too narrow | 1 | Increased tile width by 20px and raised character-name text size. |
| 2026-09-19 | Round titles felt detached and narrow rows centered awkwardly | 1 | Strengthened title sizing/margins and changed overflow rows to stable left anchoring while preserving centering for short rows. |
| 2026-09-19 | Round titles were left-aligned against the requested composition | 1 | Restored centered title alignment without changing the responsive row behavior. |
| 2026-09-19 | Current round was mixed into historical list presentation | 1 | Kept the active round separate and added a decorated fixed result surface for completed rounds. |
| 2026-09-19 | New result panel risked colliding with rounded surfaces above/below | 1 | Added explicit panel inset and tracker separation so neighboring rounded borders remain distinct. |
| 2026-09-19 | Result panel felt visually disconnected from surrounding components | 1 | Removed its floating inset, matched the shared surface, and connected it directly to the tracker. |
| 2026-09-19 | Result panel still looked like a separate rounded card | 1 | Removed its rounded corners and confirmed zero outer margin. |
| 2026-09-19 | Visible gaps remained above and below the result panel | 1 | Removed the populated body flex gap and the adjacent tracker header top edge. |
| 2026-09-19 | Result panel winner/tie borders used accent colors unlike neighboring surfaces | 1 | Removed accent border overrides and kept the shared border color. |
| 2026-09-19 | Tiebreak rounds were not visible as history rows | 1 | Added prepared history entries for tiebreak stack entries. |
| 2026-09-19 | Tie history rows lacked explicit numbering | 1 | Changed labels to `${parent round} · Tie #${index}`. |
| 2026-09-19 | Tie rows disappeared after the active round resolved | 1 | Persisted resolved tie-round rolls in the history record and prepared them for display. |
| 2026-09-19 | Tiebreak rows appeared temporarily, then vanished or duplicated | 1 | Removed live-stack history synthesis and fixed persistence to capture tiebreak snapshots before the stack is cleared. |
| 2026-09-19 | Persistence test exposed that the stack was cleared before tie snapshots could be read | 1 | Added tieHistory capture at tie creation/roll submission and copied it into the resolved history entry. |
| 2026-09-19 | Two `Round 1` headers appeared at the start of history | 1 | Changed the tie row label to `Tie #1` and gave it a non-round history key. |
| 2026-09-19 | Some cases showed duplicate tie rows | 1 | Removed the two live duplicate sources and render completed tie rows only from persisted history. |
| 2026-09-19 | Completed roll-off sessions were not recoverable and the UI had no timestamps | 1 | Locked Option A: world-persisted latest-25 session history, separate history view, and ISO timestamps. |
| 2026-09-19 | Session history implementation | 1 | Added bounded world persistence, session timestamps, terminal snapshots, and a separate scrollable history view. Validation remains pending. |
| 2026-09-19 | Session-history first validation caught malformed socket control flow | 1 | Removed the extra brace introduced around terminal winner persistence; syntax validation rerun next. |
| 2026-09-19 | Session history rendered raw user IDs as a flat span list | 1 | Prepared display names and redesigned each session as a winner/timestamp header with structured round rows and tie styling. |
| 2026-09-19 | Session history omitted the winning roll value | 1 | Added a prepared winner total and a prominent tabular numeric badge to every round row. |
| 2026-09-19 | Force-resolve could label an ordinary resolved round as `Tie #1` | 1 | Removed tie inference from the presence of `tieRounds`; tie styling now requires explicit `tieRound: true` metadata. |
| 2026-09-19 | Per-round summaries duplicated the authoritative roll-off window/history | 1 | Removed automatic normal-round and tiebreak summary chat cards while retaining start, audit-roll, and final-session messages. |
| 2026-09-19 | Round-start chat messages were generic and paragraph-heavy | 1 | Changed them to structured `Round X Started` / `Tie-Break #N Started` cards with die, purpose, and participant metadata. |
| 2026-09-19 | Round-row horizontal navigation stopped working after layout changes | 1 | Restored the row as the flexible overflow owner by removing the zero-width flex basis and making the scroller/row fill the available width. |
| 2026-09-19 | Session-history toggle consumed content space | 1 | Moved the toggle into the ApplicationV2 `.window-header` and kept it module-scoped with a compact title-bar treatment. |
| 2026-09-19 | Title-bar history control needed stronger interaction feedback | 1 | Added icon/label state, `aria-pressed`, accessible labels, focus-visible styling, active state, and collision-safe flex positioning. |
| 2026-09-19 | Title-bar control order needed to match native window actions | 1 | Inserted History immediately before Foundry’s `.window-controls`, placing it left of Close and adjacent to the native menu/controls. |
| 2026-09-19 | Header placement assumption left History behavior/ordering unreliable | 1 | Removed the delegated-action attribute from the manually injected control and place it in the actual native control group when present, with scoped flex styling. |
| 2026-09-19 | History appeared left of the title because the native controls wrapper was not pushed right | 1 | Applied explicit right-group flex alignment and inserted History as the first item inside that group. |
| 2026-09-19 | Native control group became a compact floating island | 1 | Removed runtime sizing mutations from the group and made the full `.window-header` the flex container while keeping only the native group right-anchored. |
| 2026-09-19 | History was being inserted relative to a close-button parent instead of the native control group | 1 | Targeted only Foundry’s `.window-controls`/`.window-header-controls` wrapper and forced History to its first position within that right-side group. |
| 2026-09-19 | History still appeared after Close | 1 | Insert History directly before the actual close button element, not before an inferred controls wrapper. |
| 2026-09-19 | Live DOM showed Foundry’s menu control precedes Close in the header | 1 | Inserted History immediately after `[data-action="toggleControls"]`, producing title → menu → history → close. |
| 2026-09-19 | Requested control swap was not applied | 1 | Swapped the actual menu and History DOM nodes so the order is title → History → menu → Close. |
| 2026-09-19 | GM start screen was a basic picker/form | 1 | Added a structured setup summary, labeled die/wins fields, icon-supported rule controls, and preserved the existing participant/action hooks. |
| 2026-09-19 | Design review found setup accessibility and header-control P0 issues | 1 | Migrated History toward native ApplicationV2 window controls, added `aria-pressed`/keyboard participant selection, and made Start truthfully disabled below two selections. |
| 2026-09-20 | Supplied GM setup DOM showed weak hierarchy, no count/bulk controls, and a blank die summary | 1 | Added participant section hierarchy, live selection count, Select all/Clear actions, live die/wins summary synchronization, and retained accessible selection semantics. |
| 2026-09-20 | CSS Font Awesome escape rendered literally as `\\f058` in participant rows | 1 | Replaced the pseudo-element escape with a literal checkmark so the selected indicator renders without relying on a font-family glyph mapping. |
| 2026-09-20 | Start Roll-Off action did nothing from the rendered AppV2 button | 1 | Added a current-target fallback when resolving the setup footer and wired live die/wins inputs to the setup-state updater. |
| 2026-09-20 | Start click still did not transition the visible window | 1 | Added an instance-element footer fallback and explicit socket-handler failure reporting so the action can resolve the current AppV2 DOM and surface initialization failures. |
| 2026-10-11 | Round-start announcement crashed with `participantNames is not defined` | 1 | Defined participant display names inside `postRoundStarted` and added a direct regression test. |
| 2026-10-11 | Completed session history omitted persisted tiebreak rows | 1 | Added a pure history flattener and reused it for active and completed-session displays. |
| 2026-10-11 | Legacy GM panel and sidebar content duplicated the theatre window | 1 | Removed the unused app, templates, preload entry, class, and exclusive CSS while retaining the sidebar toggle. |

## Repair Verification — 2026-10-11

| Test | Result |
|------|--------|
| Module unit suite | 25 passed, 0 failed |
| JavaScript syntax | All module `.mjs` files passed `node --check` |
| Diff whitespace | `git diff --check` passed |
| Legacy UI reference scan | No tracked module source references remain |
| Docker bind-mount parity | All changed runtime assets matched host/container hashes; deleted legacy files were absent in the container |

## Bug Hardening Audit — 2026-10-11

- Traced cancellation, settings visibility, slash-command interception, roll persistence, tiebreak labeling, and chat-side-effect failure paths.
- Identified eight focused low-to-mid fixes that remain inside the existing module boundaries.
- Separated raw-socket sender authentication from this tranche because it requires an authority/protocol decision rather than a surgical patch.
- No production source changes were made during this audit.

## Bug Hardening Implementation — 2026-10-11

- Fixed cancel-state reopening by routing cancellation through the state-clearing close path.
- Made start, round, tiebreak, final-summary, and audit chat effects non-blocking to authoritative state.
- Made force-resolve all-or-nothing for roll evaluation and persistent before optional audit output.
- Added bounded start validation and participant deduplication.
- Repaired live chat-button and sidebar-toggle setting synchronization.
- Added strict `/roll` and `/r` command parsing.
- Preserved Foundry roll IDs and numbered recursive tiebreaks.

| Test | Result |
|------|--------|
| Module unit suite | 35 passed, 0 failed |
| JavaScript syntax | All runtime and test `.mjs` files passed `node --check` |
| Diff whitespace | `git diff --check` passed |
| Docker bind-mount parity | All changed runtime files matched host/container hashes |

## Second-Pass Audit — 2026-10-11

- Re-ran the 35-test module suite; all tests still pass.
- Started three independent read-only audits covering state/history, socket orchestration, and UI/settings lifecycle.
- No additional production changes have been made during this second-pass review.
- Consolidated all three audit reports against the current source and official Foundry v14 ApplicationV2 action behavior.
- Verified ten remaining correctness, UX, layout, and accessibility issues; rejected five audit claims that did not match the actual runtime model.
- No production files were changed during consolidation.

## Second Correctness Tranche — 2026-10-11

- Made completed-session history accessible with no active roll-off state.
- Removed duplicate ApplicationV2/manual roll-for-participant dispatch.
- Added start, resolution, and per-user roll concurrency guards.
- Added asynchronous socket-task rejection handling and normalized remote hook payloads.
- Replaced aggressive chat-message capture with short-lived command-intent cleanup that cannot submit twice.
- Stopped ordinary state updates from reopening manually closed windows.
- Defined all referenced module CSS variables.

| Test | Result |
|------|--------|
| Module unit and asset suite | 44 passed, 0 failed |
| JavaScript syntax | All runtime and test `.mjs` files passed `node --check` |
| Diff whitespace | `git diff --check` passed |
| Docker bind-mount parity | All second-tranche runtime files matched host/container hashes |

## 5-Question Reboot Check

| Question | Answer |
|----------|--------|
| Where am I? | Phase 8 — Live Foundry Acceptance |
| Where am I going? | Hard-refresh Foundry and exercise the repaired start, settings, cancel, force-resolve, recursive-tie, and session-history flows |
| What's the goal? | A compact roll-off workflow whose authoritative state remains correct even when optional UI or chat effects fail |
| What have I learned? | Authoritative state must be persisted and broadcast before optional chat effects, and injected controls need one synchronization path |
| What have I done? | Completed two correctness-hardening tranches, removed duplicate UI, and passed 44 unit and asset tests |
