# Xandra's Dice Tray

A compact React-powered dice tray for Foundry VTT v14.360+.

## Features

- Seven-die segmented tray: d4, d6, d8, d10, d12, d20, and d100
- Left-click to add dice and right-click to remove dice
- Shared state across collapsed and expanded chat layouts
- D&D 5e advantage and disadvantage controls
- Live formula preview
- Repeat the last successful roll without changing the current selection
- Foundry speaker and core roll-mode integration
- Keyboard focus states and localized accessible labels

## Version 0.2.0 migration

Version 0.2.0 replaces the legacy imperative implementation with the accepted React 19 and Zustand 5 implementation while preserving the `xandra-dice-tray` module ID.

The `showTray` client setting remains under the same module namespace, so existing visibility preferences continue to apply.

The legacy calculator, `enableCalculator`, and `autoRoll` settings were intentionally removed. Version 0.1.34 remains available through the `xandra-dice-tray@v0.1.34` release tag for users who need the previous calculator.

## Usage

- Left-click a die to increment its count.
- Right-click a die to decrement its count.
- Use DIS or ADV in D&D 5e to select disadvantage or advantage.
- Select Roll to submit the displayed formula using Foundry's current roll mode.
- Select Repeat Last Roll to repeat the last successful formula without changing the current queue.
- Select Clear Selection to reset the queued dice and roll mode.

## Development

```bash
pnpm --filter xandra-dice-tray typecheck
pnpm --filter xandra-dice-tray test
pnpm --filter xandra-dice-tray build
```

The production build is emitted to `dist/` and packages React, Zustand, and `@xandra/foundry-react` into a self-contained Foundry module.

## Compatibility

- Foundry VTT 14.360+
- System-agnostic tray and rolling
- Advantage/disadvantage controls are shown for D&D 5e

## License

MIT
