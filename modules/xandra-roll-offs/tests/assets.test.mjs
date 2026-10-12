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

  it('allows session history to render without active roll-off data', async () => {
    const template = await readFile(new URL('templates/roll-off-window.hbs', moduleRoot), 'utf8');
    const historyBranch = template.indexOf('{{#if showHistory}}');
    const activeDataBranch = template.indexOf('{{else if hasData}}');

    assert.ok(historyBranch >= 0);
    assert.ok(activeDataBranch > historyBranch);
  });

  it('uses ApplicationV2 actions as the single roll-for-participant handler', async () => {
    const source = await readFile(new URL('scripts/apps/RollOffWindow.mjs', moduleRoot), 'utf8');

    assert.doesNotMatch(source, /querySelectorAll\('\[data-action="rollForParticipant"\]'\)/);
  });

  it('does not reopen a manually closed window on ordinary state updates', async () => {
    const source = await readFile(new URL('scripts/apps/RollOffWindow.mjs', moduleRoot), 'utf8');
    const start = source.indexOf('static onStateChanged()');
    const end = source.indexOf('\n  constructor(', start);
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
