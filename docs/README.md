# Xandra Foundry VTT Documentation

This folder documents the repository's Foundry VTT module architecture against **Foundry VTT v14.360**.

The material is split into three layers:

- [Module Development](./module-development.md) — package structure, manifests, lifecycle, loading, and compatibility.
- [ApplicationV2](./application-v2.md) — the v14 application lifecycle and the patterns used by `xandra-roll-offs`.
- [Hooks](./hooks.md) — hook registration, cancellation semantics, lifecycle timing, and module-local events.
- [Roll-Offs Architecture](./roll-offs-architecture.md) — the actual module's state, authority, sockets, UI, and failure boundaries.
- [Verification](./verification.md) — checks for local development and live Foundry validation.

## Scope and sources

The primary references are the official Foundry documentation:

1. [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
2. [ApplicationV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html)
3. [Hooks API](https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html)

The module-specific material was checked against the source at:

`modules/xandra-roll-offs/`

The repository currently declares:

- Module: `xandra-roll-offs`
- Module version: `0.1.8`
- Minimum compatibility: `14.360`
- Verified compatibility: `14.360`
- Entry point: `scripts/main.mjs`
- Socket namespace: `module.xandra-roll-offs`

## Important distinction

The official API describes Foundry's contracts. The architecture document describes this repository's implementation. When those differ, the code and manifest determine what the module actually does; the official API determines what future changes must preserve.
