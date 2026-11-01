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
    const darkShell = css.match(/\.application\.xandra-roll-offs-window,\s*\.xandra-roll-offs-chat\s*\{([^}]*)\}/)?.[1] ?? '';
    const lightShell = css.match(/body\.theme-light \.application\.xandra-roll-offs-window:not\(\.theme-dark\),[\s\S]*?\.themed\.theme-light \.xandra-roll-offs-chat\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(darkShell, /border-radius:\s*var\(--xro-radius-xl\)/);
    assert.match(darkShell, /background:\s*var\(--xro-bg-0\)/);
    assert.match(lightShell, /border-radius:\s*var\(--xro-radius-xl\)/);
    assert.match(css, /\.application\.xandra-roll-offs-window \.window-content\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
  });

  it('gives each round card layered chrome and individualized contestant cards', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const round = css.match(/\.xro-round-group\s*\{([^}]*)\}/)?.[1] ?? '';
    const pill = css.match(/\.xro-roll-pill\s*\{([^}]*)\}/)?.[1] ?? '';
    const avatar = css.match(/\.xro-avatar\s*\{([^}]*)\}/)?.[1] ?? '';
    const value = css.match(/\.xro-roll-pill-value\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(round, /border-top-color:\s*var\(--xro-line-strong\)/);
    assert.match(round, /linear-gradient\(/);
    assert.match(round, /box-shadow:\s*inset/);
    assert.match(pill, /border:\s*1px solid/);
    assert.match(pill, /linear-gradient\(/);
    assert.match(avatar, /border-radius:\s*var\(--xro-radius-sm\)/);
    assert.match(value, /border-radius:\s*var\(--xro-radius-sm\)/);
  });

  it('keeps round groups flush with no outer margin or shadow', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const roundGroup = css.match(/\.xro-round-group\s*\{([^}]*)\}/)?.[1] ?? '';
    const followingGroup = css.match(/\.xro-round-group:not\(:first-child\)\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(roundGroup, /margin:\s*0;/);
    assert.match(roundGroup, /box-shadow:\s*none/);
    assert.match(followingGroup, /margin-top:\s*0/);
  });

  it('removes the banner top border and adds space beneath the banner', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const banner = css.match(/\.xro-surface-heading,\s*\.xro-setup-banner,\s*\.xro-live-banner\s*\{([^}]*)\}/)?.[1] ?? '';
    const bannerSpacing = css.match(/\.xro-setup-banner,[\s\S]*?\.xro-live-banner\s*\{[^}]*\}\s*\.xro-setup-banner,[\s\S]*?\.xro-live-banner\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(banner, /border-top:\s*0/);
    assert.match(banner, /border-radius:\s*0 0 var\(--xro-radius\) var\(--xro-radius\)/);
    assert.match(bannerSpacing, /margin:\s*0 0 var\(--xro-gap\)/);
  });

  it('removes the top border from the Foundry window header', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const windowHeader = css.match(/\.xandra-roll-offs-window \.window-header\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(windowHeader, /border-top:\s*0/);
  });

  it('keeps the collapsed tracker to a player label, dots, and expand toggle', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    const body = css.match(/\.xro-window-body\s*\{([^}]*)\}/)?.[1] ?? '';
    const stack = css.match(/\.xro-scroll-stack\s*\{([^}]*)\}/)?.[1] ?? '';
    const compact = css.match(/\.xro-tracker-collapsed\s*\{([^}]*)\}/)?.[1] ?? '';
    const compactRows = css.match(/\.xro-tracker\[data-expanded="false"\] \.xro-tracker-rows\s*\{([^}]*)\}/)?.[1] ?? '';
    const compactPips = css.match(/\.xro-tracker-collapsed \.xro-tracker-slot\s*\{([^}]*)\}/)?.[1] ?? '';
    const collapsedRows = css.match(/\.xro-tracker\[data-expanded="false"\] \.xro-tracker-row:not\(\.xro-tracker-row--current\)\s*\{([^}]*)\}/)?.[1] ?? '';
    const completedFooter = css.match(/\.xro-window-body--complete \.xro-footer\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(body, /background:\s*var\(--xro-bg-1\)/);
    assert.match(stack, /background:\s*transparent/);
    assert.match(compact, /display:\s*grid/);
    assert.match(compact, /grid-template-columns:\s*auto minmax\(0, 1fr\) auto auto/);
    assert.match(compactPips, /flex:\s*0 0 15px/);
    const compactSlots = css.match(/\.xro-tracker-collapsed \.xro-tracker-slots\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(compactSlots, /justify-content:\s*flex-start/);
    assert.match(compactSlots, /gap:\s*0\.18rem/);
    assert.match(compactRows, /display:\s*none/);
    assert.match(collapsedRows, /display:\s*none/);
    assert.match(completedFooter, /display:\s*flex/);
  });

  it('does not add last-roll repeat controls to the Roll-Off component', async () => {
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.doesNotMatch(component, /Repeat Last|Repeat last roll|repeatLast|lastFormula/i);
  });

  it('allows session history to render without active roll-off data', async () => {
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.match(component, /showHistory \? <SessionHistory/);
    assert.match(component, /!model\.hasData \? <SetupView/);
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

  it('does not submit another roll from the duplicate-message cleanup hook', async () => {
    const source = await readFile(new URL('scripts/main.mjs', moduleRoot), 'utf8');
    const start = source.indexOf('async function onCreateChatMessage');
    const end = source.indexOf('\nexport { matchesDiePattern }', start);
    const handler = source.slice(start, end);

    assert.match(handler, /pendingRollCapture/);
    assert.doesNotMatch(handler, /socket\.requestRoll/);
  });
});
