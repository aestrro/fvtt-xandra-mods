# Foundry Module Development in v14.360

## What a module is

Foundry treats a module as a uniquely named directory under the user data directory, containing a root `module.json` manifest. A module can provide content, interface changes, functionality, translations, or a combination of those categories.

For this repository, the source checkout is not the live Foundry data directory. The module that Foundry loads must ultimately exist under the world's `Data/modules/xandra-roll-offs/` directory, or be installed through its manifest URL.

## Recommended structure

Foundry's conventional layout is:

```text
xandra-roll-offs/
├── module.json
├── README.md
├── LICENSE.txt
├── scripts/
├── templates/
├── styles/
├── lang/
└── packs/              # only when the module ships compendium content
```

The repository's module follows this structure. Its documentation files live at repository root `docs/`, not inside the installed package.

## Manifest contract

`module.json` is required and must be valid JSON. The `id` must match the module directory exactly. This module's relevant manifest is:

```json
{
  "id": "xandra-roll-offs",
  "version": "0.1.8",
  "compatibility": {
    "minimum": "14.360",
    "verified": "14.360"
  },
  "esmodules": ["scripts/main.mjs"],
  "styles": ["styles/xandra-roll-offs.css"],
  "socket": true
}
```

### Manifest fields used here

| Field | Meaning in this module |
|---|---|
| `id` | Stable package identifier and settings namespace. |
| `title` | Human-readable name shown by Foundry. |
| `description` | Package description. |
| `version` | Module release version. |
| `compatibility` | Declared Foundry compatibility range. |
| `esmodules` | ES module entry point loaded by Foundry. |
| `styles` | CSS files automatically loaded when the module is active. |
| `languages` | Localization files and language metadata. |
| `socket` | Requests Foundry's module socket relay. |
| `manifest` / `download` | Installation and release endpoints. |
| `readme` / `license` | Package metadata links. |

`esmodules` is preferred for modern module code. Foundry loads the listed JavaScript module files when the package is active; imports are then resolved relative to the module file and its URL.

## Bootstrap lifecycle

`main.mjs` uses two lifecycle phases:

### `init`

Use `init` for registration that must happen early, before runtime UI construction. The module currently uses it to:

- register sidebar-related integration;
- register Handlebars helpers;
- establish static module behavior.

### `ready`

Use `ready` for work that requires complete game data and runtime objects. The module currently uses it to:

- register settings;
- preload Handlebars templates;
- install the socket handler;
- inject chat controls;
- register module-local runtime hooks;
- restore an existing roll-off window.

This separation matters. `game.users`, `ui`, rendered DOM elements, settings, and active world data are not reliable assumptions during initial script evaluation.

## Templates and styles

The module preloads these templates through the namespaced v14 Handlebars API:

```text
modules/xandra-roll-offs/templates/chat-round-summary.hbs
modules/xandra-roll-offs/templates/chat-rolloff-summary.hbs
modules/xandra-roll-offs/templates/sidebar-roll-offs.hbs
modules/xandra-roll-offs/templates/roll-off-window.hbs
```

The module uses `foundry.applications.handlebars.loadTemplates` when available and falls back to the legacy global helper for compatibility with older environments. New v14 code should prefer the namespaced helper.

## Settings

Settings provide persistence and synchronization through Foundry's world/client settings store.

- `activeRollOff`: world-scoped, hidden configuration, object state.
- `winTallies`: world-scoped, hidden configuration, object state.
- Display and default options use either client or world scope according to their ownership semantics.

The module logic treats the GM as the only writer of authoritative world state. Players can read the resulting state and request actions through the socket.

## Compatibility discipline

When changing Foundry-facing code:

1. preserve the `foundry.*` v14 namespaces;
2. preserve `ApplicationV2` rather than reintroducing v1 `Application` or `FormApplication` classes;
3. preserve synchronous cancellation hooks where cancellation is required;
4. preserve the manifest's minimum and verified compatibility unless a deliberate compatibility change is made;
5. validate the manifest and run the pure state tests before live testing.

## Sources

- [Official module development guide](https://foundryvtt.com/article/module-development/)
- [Foundry v14 package manifest documentation](https://foundryvtt.com/article/module-development/)
