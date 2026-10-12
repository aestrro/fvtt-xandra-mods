# Verification and Live Testing

The module's public live endpoints are:

- `https://eldrimore.aestrro.com/`
- `http://localhost:9000`

The public URL is the live deployment target. The localhost URL is the local development target. These docs do not embed credentials or assume that either endpoint is accessible from an unauthenticated client.

## Repository checks

Run from `K:\aestrro\fvtt-xandra-mods`:

```bash
pnpm test:roll-offs
```

This executes the dependency-free `node:test` suite for `scripts/state.mjs`.

Validate JavaScript syntax:

```bash
node --check modules/xandra-roll-offs/scripts/main.mjs
node --check modules/xandra-roll-offs/scripts/socket.mjs
node --check modules/xandra-roll-offs/scripts/state.mjs
node --check modules/xandra-roll-offs/scripts/settings.mjs
node --check modules/xandra-roll-offs/scripts/chat.mjs
node --check modules/xandra-roll-offs/scripts/utils.mjs
```

Validate the manifest and referenced files:

```bash
node -e "const fs=require('fs'); const p='modules/xandra-roll-offs/module.json'; const m=JSON.parse(fs.readFileSync(p)); for (const f of [...(m.esmodules||[]), ...(m.styles||[]), ...(m.languages||[]).map(x=>x.path)]) if (!fs.existsSync('modules/xandra-roll-offs/'+f)) throw new Error('Missing '+f); console.log('manifest ok')"
```

Check patch whitespace:

```bash
git diff --check
```

## Foundry console checks

After changing module JavaScript, restart Foundry completely. A browser refresh is not sufficient when the module script is cached or the server process has not reloaded the package.

In the browser developer console, confirm:

```text
Xandra Roll-Offs | Initialization complete.
xandra-roll-offs | Socket handler registered
```

The exact logging prefix can vary by path, but there should be no module evaluation error before these messages.

## Manual v14.360 acceptance path

1. Activate `xandra-roll-offs` in the world.
2. Confirm no module evaluation error appears in the console.
3. Confirm the module's settings are registered.
4. Confirm the chat-controls dice button appears for the GM.
5. Open the Roll-Off window.
6. Select at least two participants.
7. Start a `1d20` roll-off requiring at least two wins.
8. Confirm all clients receive the start state and round announcement.
9. Roll from each participant's button.
10. Confirm the GM evaluates the rolls and the clients update from `stateUpdated`.
11. Force a tie if testing with a controlled or mocked roll path; confirm only tied users appear in the tiebreak.
12. Resolve enough rounds for a final winner.
13. Confirm the final state remains visible until the GM closes the roll-off.
14. Confirm the close action clears the active state and hides player launch affordances.
15. Test matching `/roll 1d20`: it must be captured and must not create a duplicate normal chat message.
16. Test a non-matching formula: it must pass through as ordinary Foundry chat.
17. Test a duplicate roll: it must be rejected by the authoritative handler.
18. Test a non-participant request: it must be rejected by the authoritative handler.

## Diagnostics by symptom

| Symptom | First checks |
|---|---|
| Module does not appear | Parse `module.json`; check compatibility and console evaluation errors. |
| Window does not render | Check template preload errors and `RollOffWindow.PARTS`. |
| Button does not appear | Check `renderChatLog`, `#chat-controls`, and `showChatButton`. |
| Sidebar launcher missing | Check `renderSidebar`, `setup`, `ready`, and `#sidebar-tabs > menu.flexcol`. |
| Players do not update | Check GM broadcast and receiving-client `Hooks.callAll`. |
| `/roll` still posts normally | Check that the `chatMessage` callback is not `async` and returns `false`. |
| Rolls duplicate | Check the audit flag and `createChatMessage` fallback. |
| Player can roll for another user | Check both the client guard in `requestRoll` and GM-side `canUserRoll`. |
| Final window closes too early | Check for the existence of roll-off data, not only `active === true`. |

## Safety boundary

Live verification can mutate world settings and create chat messages. Use a test world or obtain explicit confirmation before performing state-changing operations against the public instance. Never place Foundry credentials, session tokens, or secrets in this repository or in these docs.
