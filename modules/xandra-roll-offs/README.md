# Xandra Roll-Offs

A Foundry VTT module for GM-run, multi-round roll-off contests with automatic tiebreak resolution and persistent win tallies.

## Features

- GM configures die type, wins needed, and participants in a React-powered window.
- GM and assistant-GM slots are always included; Select all / Clear affects players only.
- Each GM can choose any world character or NPC as their display identity in setup, or use their GM name. Identities are locked into the session when it starts; participant user IDs and scoring do not change.
- Participants roll from the window or by typing a standard `/roll` command matching the configured die pattern.
- Rolls are evaluated authoritatively on the GM client.
- Ties spawn recursive tiebreak rounds scoped to the tied participants.
- Completed sessions are saved in a bounded, shared history.

## Chat and roll authority

- Chat defaults to one contest-start message and one final summary. Individual roll cards, subsequent-round announcements, and tiebreak announcements are opt-in world settings; existing saved preferences are preserved.
- Foundry's active GM is the single roll authority. Player and assistant-GM requests are acknowledged by that GM; ordinary rolls, forced rolls, and round changes are serialized.
- Roll identity includes the session, round/tiebreak, and participant. Repeated requests acknowledge an existing result without rolling or posting again; requests from an old round are rejected.
- Intercepted `/roll` commands suppress their native copies. Unrelated system and macro messages are left untouched.
- Chat cards are reserved before posting. If posting has an ambiguous failure, the module does not retry the card automatically: the result remains saved in the panel, but a chat card may be missing. This favors avoiding duplicates over guaranteed chat delivery.
- Dice So Nice animations run independently of chat cards. Each client reveals values and winner/score cues only after its own animation completes; the result modal follows after a 500 ms pause. Disabled or unavailable dice animations do not block results.
- If a request times out or the GM disconnects, check the panel before retrying. These protections cover module-managed messages, not independent messages created by third-party modules.

## Development

The React window is bundled with the existing rules, socket, and chat adapters by `pnpm --filter xandra-roll-offs build`. The generated `dist/` directory contains the installable module assets, including both chat-card templates. `pnpm --filter xandra-roll-offs test` runs the existing rules/socket tests and the React component tests; `pnpm --filter xandra-roll-offs typecheck` checks the TypeScript UI.

## Compatibility

Foundry VTT v14.360+

## License

MIT
