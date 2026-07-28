<a id="famicom-sdk"></a>
# Famicom SDK

[中文](famicom.zh.md) · [SDK map](sdk-map.md)

Bundles: `odd.famicom`, optional `odd.famicom.ui`. Online: [FC/NES cloud gaming](https://oddengine.com/en/solution/nes-cloud-gaming.html), [game room](https://oddengine.com/en/solution/nes-cloud-gaming-room.html).

<a id="cloud-game-client"></a>
## Cloud game client

Famicom is a WebRTC receive-only cloud-game client. It creates or joins a server game instance through HTTP SDP endpoints, receives audio/video, and sends an unordered low-lifetime one-byte controller state over a DataChannel.

| Module | Responsibility |
| --- | --- |
| `Famicom` | Session lifecycle, signaling requests, PeerConnection, media/video, DataChannel input, cookies, stats |
| `Famicom.UI` | DOM shell, plugin registry, keyboard/touch/gamepad input, fullscreen/share workflow |

## Features

- **Multi-instance cloud gaming:** independent clients can create or join separate server game instances.
- **Four player slots:** player-slot normalization, per-instance/slot cookies, and share links support P1 through P4 assignment.
- **Low-latency media and input:** receive-only WebRTC carries audio/video while an unordered short-lifetime DataChannel carries compact controller state.
- **Unified controls and telemetry:** keyboard, touch, joystick, and gamepad converge on one key API; FPS, NACK, PLI, dropped-frame, and freeze deltas are reported.
- `init`, `join`, `leave`, and `destroy` express server resource ownership explicitly.
- One bitmask is the wire format for all input sources.
- Key reference counts prevent keyboard, touch, and gamepad sources from releasing each other's pressed keys.
- Input state is sent immediately and refreshed every 40 ms, balancing responsiveness with recovery from packet loss.
- Core/UI separation keeps session control usable without the supplied controls.
- Stats normalization dispatches a compact game-oriented view: FPS, NACK, PLI, dropped frames, and freezes.

<a id="input-and-statistics"></a>
## Input and statistics

Keys are `up`, `down`, `left`, `right`, `start`, `select`, `btn_b`, and `btn_a`. UI maps `KeyboardEvent.code`, Gamepad buttons/axes, mouse/touch buttons, and an optional 4/8-direction joystick into these keys.

The browser client prefers Opus and H264 packetization-mode 1 / constrained-baseline capability when the browser supports codec preferences.

<a id="plugins"></a>
## Plugins

| Plugin | Status | Main role / configuration |
| --- | --- | --- |
| `Display` | **Verified** | game menu, sharing, live stats; `layout`, `open`, `autohide`, `timeout`, `stats`, `visibility` |
| `Controlbar` | **Verified** | mobile controls; `layout`, `mobileonly`, `visibility` |

UI components: Button and JoyStick. Both plugins receive the top-level joystick configuration.

## Configuration

### Core

| Group | Keys |
| --- | --- |
| Signaling/resource | `url`, `msid`, `game`, `instance`, `player`, `playerSlot` |
| Media | `autoplay`, `controls`, `muted`, `playsinline`, `audio`, `video` |
| RTC/data | `dataChannel`, `iceServers`, `iceTransportPolicy`, `bundlePolicy` |
| HTTP | `loader.name`, `loader.mode`, `loader.credentials` |

### UI

`skin`, `keyboard`, `gamepad.buttons`, `gamepad.threshold`, `joystick.center`, `joystick.direction`, and `plugins[]`, merged with all core keys.

## Interfaces

| Reference | Coverage |
| --- | --- |
| [Audited interface table](famicom-api.md#interfaces) | Factories/constants, core/UI facades, key/stats methods, plugins and components |

## Events

| Reference | Coverage |
| --- | --- |
| [Audited event table](famicom-api.md#events) | Core lifecycle/status/stats, UI display and input events with payloads |

## Source map

- Core: [`famicom.js`](../../../src/famicom/famicom.js)
- UI coordinator: [`ui.js`](../../../src/famicom/ui/ui.js)
- Plugins/components: [`src/famicom/ui`](../../../src/famicom/ui)
- Online integration source: [`www game room`](../../../../www/en/solution/nes-cloud-gaming-room.html)

## Known boundaries

- Famicom depends on matching server `/init`, `/join`, `/leave`, and `/destroy` semantics.
- Requests always use omitted credentials; authentication headers are not modeled.
- DataChannel input is intentionally unreliable and must be tolerated server-side.
- The source contains a duplicate `var player` declaration in `leave`.
- There is no automated multi-browser/gamepad/session-resource test suite.
