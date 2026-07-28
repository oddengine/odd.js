# IM interfaces and events

[中文](im-api.zh.md) · [IM SDK](im.md) · [Common event contract](common-api.md#event-listener-contract)

Methods from `join` through `state` are attached to the IM/UI facade only after the messaging `NetStream` binds.

## Interfaces

The public IM API is split into the Core facade, the optional UI facade, and the `NetConnection`/`NetStream` instances returned or exposed by the Core. Protocol message parsers and UI plugin/component contracts are implementation details.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, netConnection?: NetConnection, logger?: Logger \| LoggerConfig | Returns the stable IM Core for `id`, creating it when absent. Implemented by `IM.get` and exposed as `odd.im`. |
| `create` | netConnection?: NetConnection, logger?: Logger \| LoggerConfig | Creates an IM Core using the next numeric id. |

### Core instance interfaces

Methods from `join` through `state` are attached after the messaging `NetStream` binds.

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | — | Returns the registry id. |
| `setup` | config?: IMConfig | Creates the connection and messaging stream, then connects. |
| `client` | — | Returns the active `NetConnection`. |
| `join` | resourceId: string | Joins a group/resource. |
| `leave` | resourceId: string | Leaves a group/resource. |
| `chmod` | resourceId: string, targetId: string, operator: string, mask: number | Changes a member permission mask. |
| `invoke` | path: string, args?: unknown, env?: Record<string, unknown>, dir?: string, timeout?: number | Invokes a remote service path. |
| `quit` | pid: number | Requests that a logical pipe quit. |
| `send` | type: string, cast: string, id: string \| undefined, data: unknown, payload?: Uint8Array | Sends a typed message. |
| `sendStatus` | transactionId: number, status: { level: string; code: string; description: string; info?: unknown } | Sends a correlated status response. |
| `call` | transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | Sends a correlated call. |
| `state` | — | Returns the connection state. |
| `destroy` | reason?: string | Closes IM resources and removes the Core instance. |

### UI static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable UI instance paired with the same-id Core. Implemented by `IM.UI.get` and exposed as `odd.im.ui`. |
| `create` | logger?: Logger \| LoggerConfig | Creates an IM UI instance using the next numeric id. |

### UI instance interfaces

After binding, the UI forwards the Core instance interfaces from `client` through `state`. They are intentionally not duplicated below.

| Method | Arguments | Description |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: IMUIConfig | Builds the UI and initializes the paired Core. |
| `resize` | — | Resizes the IM layout and plugins. |
| `destroy` | reason?: string | Removes UI resources, destroys the paired Core, and unregisters the UI. |

### NetConnection instance interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `pid` | — | Returns the connection pipe id. |
| `uuid` | — | Returns the connection UUID when present. |
| `userId` | — | Returns the authenticated user id. |
| `setProperty` | key: string, value: unknown | Stores connection metadata. |
| `getProperty` | key: string | Returns connection metadata. |
| `connect` | url: string, parameters?: Record<string, unknown> | Opens the WebSocket connection and performs setup. |
| `process` | packet: Message | Processes an incoming decoded packet. |
| `create` | netStream: NetStream, responder?: Responder | Creates a logical stream/pipe. |
| `call` | pipe: number, transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | Sends a correlated call on a pipe. |
| `write` | type: number, pipe: number, payload?: Uint8Array | Serializes and sends a protocol packet. |
| `state` | — | Returns the connection state. |
| `release` | reason?: string | Releases the connection. |
| `close` | reason?: string | Closes the transport and active pipes. |

### NetStream instance interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `pid` | — | Returns the logical pipe id. |
| `uuid` | — | Returns the stream UUID when present. |
| `client` | — | Returns the attached `NetConnection`. |
| `attach` | netConnection: NetConnection | Attaches the stream to a connection. |
| `setProperty` | key: string, value: unknown | Stores stream metadata. |
| `getProperty` | key: string | Returns stream metadata. |
| `join` | resourceId: string | Joins a group/resource. |
| `leave` | resourceId: string | Leaves a group/resource. |
| `chmod` | resourceId: string, targetId: string, operator: string, mask: number | Changes a member permission mask. |
| `invoke` | path: string, args?: unknown, env?: Record<string, unknown>, dir?: string, timeout?: number | Invokes a remote service path. |
| `quit` | pid: number | Requests that a logical pipe quit. |
| `send` | type: string, cast: string, id: string \| undefined, data: unknown, payload?: Uint8Array | Sends a typed message. |
| `sendStatus` | transactionId: number, status: { level: string; code: string; description: string; info?: unknown } | Sends a correlated status response. |
| `call` | transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | Sends a correlated call. |
| `process` | packet: Message | Processes an incoming decoded packet. |
| `state` | — | Returns the stream state. |
| `release` | reason?: string | Releases the logical stream. |
| `close` | reason?: string | Closes the logical stream. |

## Events

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`; Core events are forwarded to UI.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | The messaging stream bound and facade command interfaces became available. |
| READY | — | The connection and messaging stream are ready. |
| ERROR | name: string, message: string | **Reserved on the facade:** most setup or connection failures reject promises or arrive through `NET_STATUS`. |
| RELEASE | reason?: string | A logical `NetStream` was released. |
| CLOSE | reason?: string | The signaling connection closed; the facade may schedule reconnection first. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | A connection, group, message, request, or stream notification arrived, including direct and group-message delivery. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| RESIZE | width: number, height: number | The IM UI was resized. |

### GlobalEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | A selection, tab, or slider value changed. |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | A named panel became `visible` or `hidden`. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | A named button, select item, message, or contact was clicked. |
| MOUSE_MOVE | name: string, value: number | The pointer moved over a slider. |

The shared `Code` table contains the concrete `NET_STATUS` codes; see [Common event constants](common-api.md#event-constants).

## Audit evidence

- [`im.js`](../../../src/im/im.js)
- [`im.netconnection.js`](../../../src/im/im.netconnection.js)
- [`im.netstream.js`](../../../src/im/im.netstream.js)
- [`src/im/ui`](../../../src/im/ui)
