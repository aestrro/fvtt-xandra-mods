# Xandra Roll-Offs

A Foundry VTT module for GM-run, multi-round roll-off contests with automatic tiebreak resolution and persistent win tallies.

## Features

- GM configures die type, wins needed, and participants in a React-powered window.
- GM can also participate as a contestant.
- Participants roll from the window or by typing a standard `/roll` command matching the configured die pattern.
- Rolls are evaluated authoritatively on the GM client.
- Ties spawn recursive tiebreak rounds scoped to the tied participants.
- Completed sessions are saved in a bounded, shared history.

## Development

The React window is bundled with the existing rules, socket, and chat adapters by `pnpm --filter xandra-roll-offs build`. The generated `dist/` directory contains the installable module assets, including both chat-card templates. `pnpm --filter xandra-roll-offs test` runs the existing rules/socket tests and the React component tests; `pnpm --filter xandra-roll-offs typecheck` checks the TypeScript UI.

## Compatibility

Foundry VTT v14.360+

## License

MIT
