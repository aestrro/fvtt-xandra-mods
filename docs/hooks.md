# Hooks in Foundry v14

Hooks are Foundry's event framework. A hook name identifies an event; registered callbacks run when that event is triggered.

Official reference: [Hooks API](https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html)

The API is exposed through the v14 Foundry namespace and also through the familiar global `Hooks` alias used by the module.

## Registration

```js
const id = Hooks.on('someEvent', (value) => {
  // react to the event
});
```

`Hooks.on` returns a numeric callback ID. Retain that ID when the listener may need to be removed.

For one-shot setup:

```js
Hooks.once('init', () => {
  // executes once
});
```

`Hooks.once` is equivalent to registering with the `{ once: true }` option.

## Invocation semantics

### `Hooks.call`

`Hooks.call(hook, ...args)` invokes listeners in registration order and stops if a listener returns `false`. It returns a boolean indicating whether all hooks ran without execution being prevented.

This is the cancellation mechanism for hook events where Foundry honors a false return value.

### `Hooks.callAll`

`Hooks.callAll(hook, ...args)` invokes all registered listeners and does not use a listener's return value to stop execution. It returns `void`.

Use `callAll` for notifications and module-local event fan-out.

### `Hooks.off`

```js
Hooks.off('someEvent', id);
```

`off` removes a callback by its numeric registration ID or function reference.

## The synchronous cancellation rule

The module intercepts matching `/roll` commands in the `chatMessage` hook. That handler must return `false` synchronously:

```js
Hooks.on('chatMessage', (chatLog, messageText, data) => {
  if (!shouldCapture(messageText)) return;

  socket.requestRoll(game.userId).catch(console.error);
  return false;
});
```

Do not mark this callback `async`. An `async` function always returns a Promise, and a Promise is not the synchronous `false` value Foundry uses to suppress the original chat message. The request can run in the background; the hook itself must finish synchronously.

## Lifecycle hooks used by the module

| Hook | Use |
|---|---|
| `init` | Early registration of sidebar integration and template helpers. |
| `setup` | Late-safe sidebar injection attempt. |
| `ready` | Settings, templates, sockets, runtime DOM, and game-state-dependent handlers. |
| `renderChatLog` | Add or refresh the module's chat-controls launcher. |
| `renderSidebar` | Retry sidebar navigation injection after sidebar rendering. |
| `chatMessage` | Synchronously intercept a matching participant `/roll`. |
| `createChatMessage` | Fallback capture for rolls that bypass `chatMessage`. |

## Module-local hooks

Modules can define namespaced events without modifying Foundry core. This module uses:

```text
xandraRollOffs.stateUpdated
xandraRollOffs.roundStarted
xandraRollOffs.tiebreakStarted
xandraRollOffs.rollOffEnded
xandraRollOffs.rollOffCancelled
```

The socket layer calls these events locally after it handles or emits state changes:

```js
Hooks.callAll(`xandraRollOffs.${type}`, payload);
```

Applications subscribe to these events to refresh themselves. For example, `RollOffWindow` listens for `stateUpdated`, checks the persisted active state, and opens or closes itself accordingly.

### Why namespacing matters

Generic event names such as `stateUpdated` can collide with other modules. A module-specific prefix makes ownership explicit and lets consumers identify the event source.

## Hook payload discipline

Use stable, documented payload shapes. The module's socket protocol uses flattened socket data:

```js
game.socket.emit('module.xandra-roll-offs', {
  type: 'stateUpdated',
  ...payload,
});
```

The local event receives the payload object directly. Broadcast handlers normalize the socket event and call the matching local hook on each client.

## Error handling

Hooks do not turn asynchronous work into synchronous work. If a synchronous hook starts a Promise, attach an error handler:

```js
socket.requestRoll(game.userId).catch((error) => {
  console.error('xandra-roll-offs | requestRoll failed', error);
});
```

Optional UI hooks should degrade safely when the target DOM has not rendered yet. The module guards `#chat-controls`, `#sidebar-tabs`, and application elements before operating on them.

## Sources

- [Hooks API](https://foundryvtt.com/api/classes/foundry.helpers.Hooks.html)
- [Foundry module development guide](https://foundryvtt.com/article/module-development/)
