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
    const darkTokens = css.match(/\.application\.xandra-roll-offs-window,\s*\.xandra-roll-offs-chat\s*\{([^}]*)\}/)?.[1] ?? '';
    const lightTokens = css.match(/body\.theme-light \.application\.xandra-roll-offs-window:not\(\.theme-dark\),[\s\S]*?\{([^}]*)\}/)?.[1] ?? '';
    const component = await readFile(new URL('src/components/RollOffApp/index.tsx', moduleRoot), 'utf8');
    assert.match(darkTokens, /--xro-primary:\s*#6ea8fe/);
    assert.match(lightTokens, /--xro-primary:\s*#255eaf/);
    assert.doesNotMatch(darkTokens, /--xro-text:\s*var\(--color-/);
    assert.match(component, /className="xro-app-content"/);
    assert.doesNotMatch(component, /className="xandra-roll-offs-window"/);
  });

  it('uses one-seam selection and visible keyboard focus in the React window', async () => {
    const css = await readFile(new URL('styles/xandra-roll-offs.css', moduleRoot), 'utf8');
    assert.match(css, /\.xro-gm-user-row--selected[\s\S]*?inset 0 0 0 1px var\(--xro-primary\)/);
    assert.match(css, /\.xro-gm-selection-actions button \+ button\s*\{\s*border-left: 0/);
    const rollForRule = css.match(/\.xro-pill-roll-btn\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(rollForRule, /display: flex !important/);
    assert.doesNotMatch(rollForRule, /display: none/);
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
