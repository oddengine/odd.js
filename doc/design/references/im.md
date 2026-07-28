<a id="im-sdk"></a>
# IM SDK

[中文](im.zh.md) · [Product goals](product-map.md) · [SDK map](sdk-map.md)

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
- Core/UI separation and same-id pairing match Player, NES, and Famicom.

<a id="plugins"></a>
## Plugins

| Plugin | Status | Main role / configuration |
| --- | --- | --- |
| `Messages` | **Verified** | conversation tabs/dialogs and text message handling; `layout`, nested `dialog`, `visibility` |
| `Contacts` | **Skeleton** | layout/component shell; `layout`, `visibility` |
| `Settings` | **Skeleton** | layout/component shell; `layout`, `visibility` |

UI components include Button, Dialog, Label, Panel, Select, Slider, and Tab. The current `Dialog` is a conversation composer/view, not the Player product target's Notify/Alert/Confirm abstraction.

## Configuration

### Core

| Key | Meaning |
| --- | --- |
| `url` | IM WebSocket endpoint |
| `parameters.token` | connect parameter |
| `maxRetries` | retry count; `-1` means unlimited |
| `retryIn` | initial randomized retry delay |
| `maxRetryInterval` | exponential-backoff ceiling |

`NetConnection` also has ACK-window/peer-bandwidth defaults. `NetStream` currently has no independent defaults.

### UI

`skin`, `plugins[]`, plus all core keys. Plugin config is merged from each registered plugin's `prototype.CONF`.

## Interfaces

| Reference | Coverage |
| --- | --- |
| [Audited interface table](im-api.md#interfaces) | Core/UI factories and facades, NetConnection, NetStream, protocol helpers, plugins and components |

## Events

| Reference | Coverage |
| --- | --- |
| [Audited event table](im-api.md#events) | Lifecycle, connection/group/message status, UI and declared-but-indirect events with payloads |

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
- `Contacts` and `Settings` build shells but contain no domain behavior.
- There is no normalized user-list, call-state, mute, kick, or recording-control model.
- UI content uses `innerHTML` in multiple places; untrusted text needs sanitization.
