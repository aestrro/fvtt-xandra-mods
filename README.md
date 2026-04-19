# fvtt-xandra-mods

A monorepo of Foundry VTT modules by Xandra, managed with pnpm workspaces.

## Modules

| Module | Description | Latest |
|---|---|---|
| [xandra-dice-tray](./modules/xandra-dice-tray) | A modern, lightweight dice tray and calculator for Foundry VTT v14 | TBD |

## Installation

Each module can be installed via its **Manifest URL**. See the module's README for the exact URL.

## Development

### Prerequisites
- [pnpm](https://pnpm.io/) (v10)
- Node.js 22+

### Setup
```bash
pnpm install
```

### Repository Structure
```
fvtt-xandra-mods/
├── modules/
│   └── xandra-dice-tray/    # Individual Foundry module
│       ├── module.json
│       ├── package.json
│       ├── scripts/
│       ├── styles/
│       ├── templates/
│       └── lang/
├── .github/workflows/        # CI & release automation
├── package.json              # Root workspace config
└── pnpm-workspace.yaml
```

## Releasing

This repo uses **per-module tags** to trigger independent releases.

```bash
git tag xandra-dice-tray@v0.1.0
git push origin xandra-dice-tray@v0.1.0
```

The release workflow will:
1. Parse the module name and version from the tag.
2. Update that module's `module.json` version and download URL.
3. Package the module into a `module.zip`.
4. Create a GitHub Release with the zip and manifest attached.

## License

MIT
