<a id="im-sdk"></a>
# IM SDK

[中文](im.zh.md) · [Product goals](architecture.md#target-tree) · [Architecture](architecture.md)

<!-- TOC -->
## Contents

- [Facade](#facade)
- [Transport and protocol](#transport-and-protocol)
- [Features](#features)
- [Plugins](#plugins)
- [Configuration](#configuration)
  - [Core](#core)
  - [UI](#ui)
- [Interfaces](#interfaces)
  - [Core static interfaces](#core-static-interfaces)
  - [Core instance interfaces](#core-instance-interfaces)
  - [UI static interfaces](#ui-static-interfaces)
  - [UI instance interfaces](#ui-instance-interfaces)
  - [NetConnection instance interfaces](#netconnection-instance-interfaces)
  - [NetStream instance interfaces](#netstream-instance-interfaces)
- [Events](#events)
  - [Event](#event)
  - [NetStatusEvent](#netstatusevent)
  - [UIEvent](#uievent)
  - [GlobalEvent](#globalevent)
  - [MouseEvent](#mouseevent)
- [Audit evidence](#audit-evidence)
- [Product signaling capability](#product-signaling-capability)
- [Source map](#source-map)
- [Known boundaries](#known-boundaries)
<!-- /TOC -->

Bundles: `odd.im`, optional `odd.im.ui`. Online: [Instant messaging](https://oddengine.com/en/solution/im.html).

<a id="facade"></a>
## Facade

`IM` owns reconnect policy, one `NetConnection`, and one messaging `NetStream`. After the stream attaches, it binds room, permission, process-control, message, status, and generic call operations directly onto the facade.

<a id="transport-and-protocol"></a>
## Transport and protocol

| Module | Role |
| --- | --- |
| `NetConnection` | WebSocket lifecycle, fixed packet header, sequence/ACK windows, pipe creation/routing |
| `NetStream` | Logical messaging pipe, room and message commands, per-pipe responders |
| Message classes | Abort, ACK-window, ACK, and JSON command messages with optional binary payload |
| `Responder` | Result/status callbacks for request-response commands |
| `State` | initialized, connecting, connected, closing, closed |

The protocol design allows one connection to host multiple logical pipes. RTC can attach its stream to the same connection while using WHIP/WHEP for media negotiation.

## Features

- **Multi-instance core and UI:** `get/create` registries isolate connections and pair UI with the matching IM instance.
- **Room and direct messaging:** join/leave, unicast, multicast, typed JSON data, custom messages, and optional binary payload share one command channel.
- **Reconnect policy:** randomized initial retry and bounded exponential backoff are built into the facade.
- **Control plane:** permission masks, generic request-response calls, and remote process invoke/quit operations extend beyond chat.
- Framing, connection, logical stream, and application facade are separate layers.
- Commands carry JSON arguments and optional binary payload, preserving extensibility.
- Request-response correlation is isolated in `Responder` maps.
- The facade exposes a small domain API while transport methods remain available for lower-level integration.
- Reconnection belongs to the facade, not to the packet parser.
- Core/UI separation and same-id pairing match Player and Famicom.

<a id="plugins"></a>
## Plugins

| Plugin | Status | Main role / configuration |
| --- | --- | --- |
| `Contacts` | **Implemented** | address-book plugin; creates an independent Contact component for each friend or group through `layout` |
| `Conversations` | **Implemented** | recent-conversation list plugin; creates Contact components through `layout` and forwards selection to the UI coordinator |
| `Conversation` | **Implemented** | single-conversation window; composes Messages and Composer through `layout` and coordinates IM send/receive |
| `Dashboard` | **Implemented** | references Settings and other settings components through `layout`; Settings is not a plugin |

UI components include Button, Label, Tab, Avatar, Contact, Messages, Message, Composer, and Settings. Messages is the Message collection; Message uses `align="left|right"` for direction. Composer replaces the old Dialog while retaining its emoji data. Component-level Contacts, Conversations, and Transcript no longer exist. Components own their data, DOM, state, and teardown; plugins only assemble layouts and coordinate network events.

Contacts uses the `contacts` tab, while Conversations and Conversation share the `messages` tab. A contact or recent-conversation click emits a semantic event; IM UI then activates Conversation and selects the messages tab. App can inject playback, game, and meeting pages into this same Tab instead of building another navigation system.

## Configuration

### Core

| Key | Meaning |
| --- | --- |
| `url` | IM WebSocket endpoint |
| `parameters.token` | connect parameter |
| `retry.delay` | base retry delay; each connection adds 0–3 seconds of jitter |
| `retry.count` | retry count; `-1` means unlimited |

`NetConnection` also has ACK-window/peer-bandwidth defaults. `NetStream` currently has no independent defaults.

### UI

`skin`, `plugins[]`, plus all core keys. Plugin config is merged from each registered plugin's `prototype.CONF`.

## Interfaces

`setup()` always connects immediately and attaches the messaging `NetStream`, so callers can send as soon as it resolves. The public connection lifecycle is only `setup()` plus `destroy()`; there is no second `connect()` facade. Methods from `join` through `state` are attached when the messaging stream binds.

The public IM API is split into the Core facade, the optional UI facade, and the `NetConnection`/`NetStream` instances returned or exposed by the Core. Protocol message parsers and UI plugin/component contracts are implementation details.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable IM Core for `id`, creating it when absent. Implemented by `IM.get` and exposed as `odd.im`. |
| `create` | logger?: Logger \| LoggerConfig | Creates an IM Core using the next numeric id. |

### Core instance interfaces

Methods from `join` through `state` are attached after the messaging `NetStream` binds.

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | — | Returns the registry id. |
| `setup` | config?: IMConfig | Creates the connection and messaging stream, then connects. |
| `client` | — | Returns the active `NetConnection`. |
| `connected` | — | Returns whether the IM connection is in the connected state. |
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
| `presentation` | value?: 'full' \| 'mini' \| 'popup' | Reads or sets the UI presentation. |
| `skin` | value?: string | Reads or sets the skin. |
| `attach` | container: HTMLElement, presentation?: string | Reattaches the same IM wrapper to a container. |
| `attachPlugin` | kind: string, container: HTMLElement, presentation?: string | Attaches a named plugin. |
| `restorePlugin` | kind: string, presentation?: string | Restores a plugin to the original Tab container created by its layout. |
| `insert` | name: string, selector: string \| HTMLElement, content: HTMLElement, option?: object | Inserts a page into the IM root Tab. |
| `active` | value?: string \| number | Reads or selects the active root Tab. |
| `page` | value: string \| number | Returns a root Tab page. |
| `element` | — | Returns the current mount container. |
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
| CHANGE | name: string, value: unknown, tab?: string | A selection, tab, or slider value changed; root Tab changes also include the stable `tab` name. |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | A named panel became `visible` or `hidden`. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | A named button, select item, message, or contact was clicked. |
| MOUSE_MOVE | name: string, value: number | The pointer moved over a slider. |

The shared `Code` table contains the concrete `NET_STATUS` codes; see [Common event constants](common.md#event-constants).

## Audit evidence

- [`im.js`](../../../src/im/im.js)
- [`im.netconnection.js`](../../../src/im/im.netconnection.js)
- [`im.netstream.js`](../../../src/im/im.netstream.js)
- [`src/im/ui`](../../../src/im/ui)

## Product signaling capability

<a id="cap-im"></a>Instant messaging is **Verified**: room join/leave, unicast/multicast message, text UI, arbitrary data and optional binary payload.

<a id="cap-custom-message"></a>Custom messages are **Verified** through `send(type, cast, id, data, payload)`.

<a id="cap-im-call"></a>Generic request-response `call` is **Verified**, but a call/answer/reject/timeout product state machine is **Planned**.

<a id="cap-im-mute"></a>`chmod` provides generic permission masks, but no named mute contract or participant state model is present: **Partial**.

<a id="cap-im-kick"></a>`invoke` and `quit` control server processes, not room participant kicking: kick is **Planned**.

## Source map

- Facade/retry: [`im.js`](../../../src/im/im.js)
- Transport: [`im.netconnection.js`](../../../src/im/im.netconnection.js)
- Logical stream: [`im.netstream.js`](../../../src/im/im.netstream.js)
- Messages/protocol constants: [`src/im/message`](../../../src/im/message)
- UI/plugins/components: [`src/im/ui`](../../../src/im/ui)

## Known boundaries

- Pending responder entries have no timeout-based cleanup.
- Contacts, Conversations, Conversation, and Dashboard assemble components; the old Dialog, Workspace, and component-level Contacts/Conversations/Transcript are removed.
- There is no normalized user-list, call-state, mute, kick, or recording-control model.
- UI content uses `innerHTML` in multiple places; untrusted text needs sanitization.
