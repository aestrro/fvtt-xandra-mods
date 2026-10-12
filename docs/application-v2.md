# ApplicationV2 in Foundry v14

`ApplicationV2` is Foundry's current application framework. It renders an application-owned `HTMLElement` into the Foundry UI and manages configuration, rendering, positioning, window state, event dispatch, and lifecycle transitions.

Official reference: [ApplicationV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html)

## Core model

An ApplicationV2 instance has:

- immutable normalized `options`;
- an `element` accessor for the rendered root element;
- `position` state relative to `document.body`;
- `rendered`, `minimized`, `state`, `title`, and `window` accessors;
- static `DEFAULT_OPTIONS` for class defaults;
- static `PARTS` in Handlebars applications for template-backed regions;
- an event-emitter interface and standard application events.

The application is not a plain template renderer. It owns a lifecycle and a DOM root. Code that needs to interact with rendered controls should therefore wait until the relevant render phase and use the application element rather than global selectors.

## Construction

The base constructor accepts an optional partial configuration object:

```js
const app = new foundry.applications.api.ApplicationV2({
  id: 'xandra-example',
});
```

For a Handlebars application, the module convention is:

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class ExampleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'xandra-example',
    classes: ['xandra-example'],
    window: { title: 'Example' },
    position: { width: 420, height: 560 },
  };

  static PARTS = {
    content: {
      template: 'modules/xandra-roll-offs/templates/roll-off-window.hbs',
    },
  };
}
```

## `DEFAULT_OPTIONS`

`DEFAULT_OPTIONS` is the class-level configuration assigned to every instance. The `xandra-roll-offs` windows use it for:

- stable module-prefixed IDs;
- CSS class scoping;
- window titles and resizability;
- initial dimensions;
- action routing;
- form behavior where applicable.

Use stable IDs. Duplicate application IDs produce confusing DOM and lifecycle behavior.

## `PARTS`

A Handlebars ApplicationV2 declares template-backed parts in `static PARTS`. The part template path is relative to the installed module root as a Foundry asset path:

```js
static PARTS = {
  content: {
    template: 'modules/xandra-roll-offs/templates/roll-off-window.hbs',
  },
};
```

The part context is prepared by `_prepareContext`. The module converts Foundry documents and state into plain display data before handing it to Handlebars. This keeps game API lookups in JavaScript and keeps templates focused on rendering.

## Rendering lifecycle

The relevant lifecycle methods are:

1. `_preRender` — pre-render preparation.
2. `_prepareContext` — construct render context.
3. `_renderHTML` — render application parts.
4. `_replaceHTML` — replace or update part DOM.
5. `_onRender` — post-render application logic and event wiring.
6. `_postRender` — later render completion work.
7. `_onPosition` — position updates.
8. `_preClose`, `_onClose`, and close transition — teardown.

The exact internal sequence is owned by Foundry. Subclasses should override documented lifecycle points and call `super` where the base class contract requires it.

The module uses `_prepareContext` for data and `_onRender` for DOM behavior. For example, `RollOffWindow._onRender` wires actions, remembers participant selection state, and scrolls the history stack after its element exists.

## Rendering and positioning

`render()` returns the application render promise. A singleton window can be opened with:

```js
static open(options = {}) {
  if (!this.#instance) this.#instance = new this();
  return this.#instance.render({ force: true, ...options });
}
```

The module's `RollOffWindow` follows this pattern. `force: true` requests a refresh even when the application is already rendered, which is important after a settings-backed state update.

`setPosition()` updates position and dimensions. `bringToFront()` raises the application above other applications. Use the application API instead of manually changing window z-indexes.

## Actions

ApplicationV2 action routing uses `data-action` attributes and the `actions` map in `DEFAULT_OPTIONS`:

```js
static DEFAULT_OPTIONS = {
  actions: {
    startRollOff: ExampleApp.startRollOff,
  },
};
```

```html
<button type="button" data-action="startRollOff">Start</button>
```

In the current module, action handlers use the `(event, target)` signature. Foundry invokes these handlers with the application instance as `this`, not with the class constructor as `this`.

### Private static fields

This distinction matters for singleton fields. A handler declared as `static async startRollOff(...)` must access the private singleton through the class name:

```js
const instance = RollOffWindow.#instance;
```

Using `this.#instance` inside an action handler is unsafe because `this` is the application instance at invocation time, not the class object that declared the private field.

### Form buttons

Do not combine `data-action` with a submit button when the same action is not intended to submit a form. Choose one behavior:

- `type="submit"` with a configured form handler; or
- `type="button"` with `data-action`.

For configuration surfaces whose buttons should not trigger automatic submission, disable form auto-handling in `DEFAULT_OPTIONS.form`:

```js
form: {
  handler: null,
  submitOnChange: false,
  closeOnSubmit: false,
}
```

The module uses this configuration in `GMPanelApp`.

## Application-local DOM

Prefer:

```js
const html = this.element;
html?.querySelector('[data-action="roll-off-roll"]');
```

over global selectors that assume a particular window layout. Global selectors are appropriate only for deliberately global integration points, such as `#chat-controls` and `#sidebar-tabs`.

## Cleanup

The module's singleton classes clear their static instance in `close()`:

```js
async close(options = {}) {
  this.constructor.#instance = null;
  return super.close(options);
}
```

If an application registers long-lived hooks, retain the hook ID and remove it with `Hooks.off` when the application lifecycle requires it. Otherwise repeated opening and closing can create duplicate listeners.

## Sidebar applications

Foundry v14 sidebar tabs are ApplicationV2-based and should extend `foundry.applications.sidebar.AbstractSidebarTab`, not the removed v1 `SidebarTab` pattern. `RollOffSidebarTab` uses the v14 namespace. Its navigation integration is intentionally a launcher button for the main `RollOffWindow`, rather than a second competing UI.

## Sources

- [ApplicationV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html)
- [Foundry module development guide](https://foundryvtt.com/article/module-development/)
