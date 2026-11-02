import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleRoot = new URL('../', import.meta.url);

describe('module assets', () => {
  it('defines every referenced xro CSS custom property', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const definitions = new Set(Array.from(css.matchAll(/(--xro-[\w-]+)\s*:/g), (match) => match[1]));
    const references = new Set(Array.from(css.matchAll(/var\((--xro-[\w-]+)/g), (match) => match[1]));
    const missing = [...references].filter((name) => !definitions.has(name)).sort();

    assert.deepEqual(missing, []);
  });

  it('scopes palette tokens to the window and chat cards in both themes', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    assert.doesNotMatch(css, /^:root\s*\{/m);
    assert.match(css, /\.application\.xandra-roll-offs-window,/);
    assert.match(css, /body\.theme-light \.application\.xandra-roll-offs-window:not\(\.theme-dark\)/);
    assert.match(css, /\.application\.xandra-roll-offs-window\.theme-light/);
    assert.match(css, /body\.theme-light \.xandra-roll-offs-chat/);
    assert.match(css, /color-scheme: dark/);
    assert.match(css, /color-scheme: light/);
  });

  it('keeps the theme palette on Foundry app chrome, not the inner React root', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const darkTokens = css.match(/\.application\.xandra-roll-offs-window,\s*\.xandra-roll-offs-chat\s*\{\s*--xro-bg-0:[^}]*\}/)?.[0] ?? '';
    const lightTokens = css.match(/body\.theme-light \.application\.xandra-roll-offs-window:not\(\.theme-dark\),\s*\.application\.xandra-roll-offs-window\.theme-light,\s*body\.theme-light \.xandra-roll-offs-chat,\s*\.themed\.theme-light \.xandra-roll-offs-chat\s*\{[^}]*--xro-primary:\s*#255eaf[^}]*\}/)?.[0] ?? '';
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.match(darkTokens, /--xro-primary:\s*#6ea8fe/);
    assert.match(lightTokens, /--xro-primary:\s*#255eaf/);
    assert.doesNotMatch(darkTokens, /--xro-text:\s*var\(--color-/);
    assert.match(component, /className="xro-app-content"/);
    assert.doesNotMatch(component, /className="xandra-roll-offs-window"/);
  });

  it('applies the requested shell radius and theme background to the Foundry window', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const darkShell = css.match(/^\.application\.xandra-roll-offs-window\s*\{([^}]*)\}/m)?.[1] ?? '';
    const lightShell = css.match(/^body\.theme-light \.application\.xandra-roll-offs-window:not\(\.theme-dark\),\s*\.application\.xandra-roll-offs-window\.theme-light\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(darkShell, /border-radius:\s*var\(--xro-radius-xl\)/);
    assert.match(darkShell, /background:\s*var\(--xro-bg-0\)/);
    assert.match(lightShell, /border-radius:\s*var\(--xro-radius-xl\)/);
    assert.match(css, /\.application\.xandra-roll-offs-window \.window-content\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
  });

  it('gives the live round larger portraits and values without nested card chrome', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const round = css.match(/^\.xro-round-group--current\s*\{([^}]*)\}/m)?.[1] ?? '';
    const pill = css.match(/^\.xro-roll-pill\s*\{([^}]*)\}/m)?.[1] ?? '';
    const avatar = css.match(/^\.xro-avatar\s*\{([^}]*)\}/m)?.[1] ?? '';
    const value = css.match(/^\.xro-roll-pill-value\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(round, /background:\s*transparent/);
    assert.match(round, /box-shadow:\s*none/);
    assert.match(pill, /border:\s*0/);
    assert.match(avatar, /width:\s*52px/);
    assert.match(value, /font-size:\s*1\.35rem/);
    assert.match(pill, /min-height:\s*96px/);
    const liveSpacing = css.match(/^\.xro-current-round \.xro-round-group\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(liveSpacing, /padding:\s*4px 0/);
    assert.match(liveSpacing, /gap:\s*3px/);
    const livePill = css.match(/^\.xro-current-round \.xro-roll-pill\s*\{([^}]*)\}/m)?.[1] ?? '';
    const liveAvatar = css.match(/^\.xro-current-round \.xro-avatar\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(livePill, /min-height:\s*88px/);
    assert.match(livePill, /flex-basis:\s*82px/);
    assert.match(liveAvatar, /width:\s*44px/);
  });

  it('keeps round groups flush with no outer margin or shadow', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const roundGroup = css.match(/^\.xro-round-group\s*\{([^}]*)\}/m)?.[1] ?? '';
    const followingGroup = css.match(/\.xro-round-group:not\(:first-child\)\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(roundGroup, /margin:\s*0;/);
    assert.match(roundGroup, /box-shadow:\s*none/);
    assert.match(followingGroup, /margin-top:\s*0/);
  });

  it('leaves bottom breathing room beneath the compact footer action bar', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const footer = css.match(/^\.xro-footer--active\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(footer, /margin:\s*8px 12px 16px/);
    assert.match(footer, /border:\s*1px solid var\(--xro-line\)/);
    assert.match(footer, /background:\s*var\(--xro-bg-3\)/);
    assert.match(footer, /padding:\s*0/);
    assert.match(footer, /gap:\s*0/);
    const currentRound = css.match(/^\.xro-current-round\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(currentRound, /max-height:\s*none/);
    assert.match(currentRound, /overflow:\s*visible/);
  });

  it('uses a quiet history frame and reserves arrow gutters only for overflowing rounds', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const stack = css.match(/^\.xro-scroll-stack\s*\{([^}]*)\}/m)?.[1] ?? '';
    const nav = css.match(/^\.xro-row-nav\s*\{([^}]*)\}/m)?.[1] ?? '';
    const scrollableNav = css.match(/^\.xro-round-scroller--scrollable \.xro-row-nav\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(stack, /border:\s*1px solid var\(--xro-line\)/);
    assert.doesNotMatch(stack, /border-left:/);
    assert.match(stack, /padding:\s*var\(--xro-round-header-half-height\) 0 0;/);
    assert.match(nav, /display:\s*none !important/);
    assert.match(scrollableNav, /display:\s*flex !important/);
  });

  it('sticks historical round headers inside the scroll area with opaque backgrounds', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const group = css.match(/^\.xro-round-group--history\s*\{([^}]*)\}/m)?.[1] ?? '';
    const heading = css.match(/^\.xro-round-group--history > \.xro-round-title-row\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(group, /overflow:\s*visible/);
    assert.match(heading, /position:\s*sticky/);
    assert.match(heading, /top:\s*calc\(-1 \* var\(--xro-round-header-half-height\)\)/);
    assert.match(heading, /background:\s*linear-gradient\(to bottom, var\(--xro-round-before\) 50%, var\(--xro-round-after\) 50%\)/);
    assert.match(heading, /margin-block:\s*calc\(-1 \* var\(--xro-round-header-half-height\)\)/);
    assert.match(group, /gap:\s*0/);
    const stripe = css.match(/^\.xro-round-group--alt\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(stripe, /background:\s*rgba\(0, 0, 0, 0\.2\)/);
    assert.doesNotMatch(css, /^\.xro-round-group--alt > \.xro-round-scroller\s*\{/m);
  });

  it('centers contestants without an outer frame and separates them with vertical dividers', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const row = css.match(/^\.xro-round-row\s*\{([^}]*)\}/m)?.[1] ?? '';
    const historyPill = css.match(/^\.xro-round-group--history \.xro-roll-pill\s*\{([^}]*)\}/m)?.[1] ?? '';
    const rollButton = css.match(/^\.xro-pill-roll-btn\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(row, /width:\s*max-content/);
    assert.match(row, /overflow-x:\s*auto/);
    assert.match(row, /border:\s*0/);
    assert.match(row, /background:\s*transparent/);
    const divider = css.match(/^\.xro-round-row > \.xro-roll-pill \+ \.xro-roll-pill::before\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(divider, /width:\s*1px/);
    assert.match(divider, /linear-gradient\(to bottom, transparent 0%, var\(--xro-line\) 50%, transparent 100%\)/);
    assert.match(historyPill, /border:\s*0/);
    assert.match(historyPill, /background:\s*transparent/);
    assert.match(rollButton, /position:\s*static/);
    const result = css.match(/^\.xro-player-result\s*\{([^}]*)\}/m)?.[1] ?? '';
    const historyResult = css.match(/^\.xro-round-group--history \.xro-player-result\s*\{([^}]*)\}/m)?.[1] ?? '';
    const name = css.match(/^\.xro-roll-pill-name\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(result, /margin-top:\s*-2px/);
    assert.match(historyResult, /margin-top:\s*-8px/);
    assert.match(name, /margin-top:\s*7px/);
  });

  it('keeps setup banner spacing and simplifies the live header', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const banner = css.match(/\.xro-surface-heading,\s*\.xro-setup-banner,\s*\.xro-live-banner\s*\{([^}]*)\}/)?.[1] ?? '';
    const bannerSpacing = css.match(/^\.xro-setup-banner\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(banner, /border-top:\s*0/);
    assert.match(banner, /border-radius:\s*0 0 var\(--xro-radius\) var\(--xro-radius\)/);
    assert.match(bannerSpacing, /margin:\s*0;/);
    assert.match(bannerSpacing, /background:\s*var\(--xro-bg-0\)/);
    const liveBanner = Array.from(css.matchAll(/^\.xro-live-banner\s*\{([^}]*)\}/gm)).at(-1)?.[1] ?? '';
    assert.match(liveBanner, /background:\s*var\(--xro-bg-0\)/);
    assert.match(liveBanner, /border:\s*0/);
  });

  it('uses the contest visual language for setup with one scrolling roster and a flat footer', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const roster = css.match(/^\.xro-gm-user-list\s*\{([^}]*)\}/m)?.[1] ?? '';
    const frame = css.match(/^\.xro-gm-roster\s*\{([^}]*)\}/m)?.[1] ?? '';
    const footer = css.match(/^\.xro-gm-footer\s*\{([^}]*)\}/m)?.[1] ?? '';
    const selected = css.match(/^\.xro-gm-user-row--selected\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(roster, /overflow-y:\s*auto/);
    assert.match(frame, /border-radius:\s*var\(--xro-radius-lg\)/);
    assert.match(frame, /background:\s*rgba\(0, 0, 0, 0\.2\)/);
    assert.match(roster, /padding:\s*0/);
    assert.match(roster, /margin:\s*0/);
    assert.match(footer, /padding:\s*12px 12px 16px/);
    assert.match(footer, /background:\s*transparent/);
    assert.match(selected, /box-shadow:\s*none/);
  });

  it('joins setup controls in one segmented bar and keeps zebra stripes with selected highlighting', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const bar = css.match(/^\.xro-setup-actionbar\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(bar, /gap:\s*0/);
    assert.match(bar, /border:\s*1px solid var\(--xro-line\)/);
    assert.match(bar, /border-radius:\s*var\(--xro-radius\)/);
    assert.match(css, /\.xro-gm-user-row:nth-child\(even\):not\(\.xro-gm-user-row--selected\):not\(:hover\)\s*\{\s*background:\s*rgba\(0, 0, 0, 0\.2\)/);
    const selected = css.match(/^\.xro-gm-user-row--selected\s*\{([^}]*)\}/m)?.[1] ?? '';
    assert.match(selected, /background:\s*var\(--xro-primary-soft\)/);
  });

  it('removes the top border from the Foundry window header', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const windowHeader = css.match(/\.xandra-roll-offs-window \.window-header\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(windowHeader, /border-top:\s*0/);
  });

  it('keeps win progress in a scrollable overlay without taking space from the rounds', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const body = css.match(/\.xro-window-body\s*\{([^}]*)\}/)?.[1] ?? '';
    const stack = css.match(/\.xro-scroll-stack\s*\{([^}]*)\}/)?.[1] ?? '';
    const popover = css.match(/^\.xro-wins-popover\s*\{([^}]*)\}/m)?.[1] ?? '';
    const progress = css.match(/^\.xro-win-progress\s*\{([^}]*)\}/m)?.[1] ?? '';
    const completedFooter = css.match(/\.xro-window-body--complete \.xro-footer\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(body, /min-height:\s*0/);
    assert.match(stack, /background:\s*rgba\(0, 0, 0, 0\.2\)/);
    assert.match(popover, /position:\s*absolute/);
    assert.match(popover, /overflow-y:\s*auto/);
    assert.match(popover, /max-height:/);
    assert.match(progress, /font-variant-numeric:\s*tabular-nums/);
    assert.match(progress, /white-space:\s*nowrap/);
    assert.match(completedFooter, /display:\s*grid/);
  });

  it('does not add last-roll repeat controls to the Roll-Off component', async () => {
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.doesNotMatch(component, /Repeat Last|Repeat last roll|repeatLast|lastFormula/i);
  });

  it('allows session history to render without active roll-off data', async () => {
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.match(component, /showHistory\s*\?\s*\(?\s*<SessionHistory/);
    assert.match(component, /!model\.hasData\s*\?\s*\(?\s*<SetupView/);
  });

  it('uses React as the single roll-for-participant handler', async () => {
    const source = await readFile(new URL('src/components/RoundTimeline/index.tsx', moduleRoot), 'utf8');
    assert.match(source, /onClick=\{\(\) => onRollFor\?/);
    assert.match(source, /disabled=\{!isParticipant\}/);
    assert.doesNotMatch(source, /data-action="rollForParticipant"/);
  });

  it('does not reopen a manually closed window on ordinary state updates', async () => {
    const source = await readFile(new URL('src/foundry/RollOffWindow/index.tsx', moduleRoot), 'utf8');
    const start = source.indexOf('static onStateChanged()');
    const end = source.indexOf('\n  static toggleHistory()', start);
    const handler = source.slice(start, end);

    assert.doesNotMatch(handler, /this\.open\(/);
  });

  it('restores saved panel visibility on startup and lets session removal update rather than close GM panels', async () => {
    const source = await readFile(new URL('scripts/main.mjs', moduleRoot), 'utf8');
    assert.match(source, /await RollOffWindow\.restore\(\)/);
    assert.match(source, /Hooks\.on\('xandraRollOffs\.rollOffCancelled', \(\) => RollOffWindow\.onStateChanged\(\)\)/);
    assert.doesNotMatch(source, /Hooks\.on\('xandraRollOffs\.rollOffCancelled', \(\) => RollOffWindow\.close\(\)\)/);
  });

  it('does not submit another roll from the duplicate-message cleanup hook', async () => {
    const source = await readFile(new URL('scripts/main.mjs', moduleRoot), 'utf8');
    const start = source.indexOf('async function onCreateChatMessage');
    const end = source.indexOf('\nexport { matchesDiePattern }', start);
    const handler = source.slice(start, end);

    assert.match(handler, /interceptedCommands/);
    assert.doesNotMatch(handler, /socket\.requestRoll/);
  });
});
