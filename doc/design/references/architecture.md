# odd.js Architecture

[中文](architecture.zh.md) · [Product goals](product-map.md) · [SDK map](sdk-map.md)

## Distribution

[`compile.sh`](../../../compile.sh) builds one shared foundation, five product SDKs, four optional UI bundles, and one aggregate bundle.

| Layer | Release bundle | Source root | Depends on |
| --- | --- | --- | --- |
| Foundation | `odd.common` | `src/odd.js`, `src/utils`, `src/events`, `src/io` | Browser |
| Player core | `odd.player` | `src/player/av`, `src/player/module`, `src/player/player*` | Common; RTC for the RTC module |
| Player UI | `odd.player.ui` | `src/player/ui` | Player, RTC/IM for selected plugins |
| RTC | `odd.rtc` | `src/rtc` | Common |
| IM core | `odd.im` | `src/im` excluding `ui` | Common |
| IM UI | `odd.im.ui` | `src/im/ui` | IM |
| NES core/UI | `odd.nes`, `odd.nes.ui` | `src/nes` | Common |
| Famicom core/UI | `odd.famicom`, `odd.famicom.ui` | `src/famicom` | Common |
| Aggregate | `odd.js` | all release bundles above | All |

The checked-in release files are generated artifacts. Source and `compile.sh` are stronger evidence than release contents.

## From product to implementation

```text
product goal
  └── owning SDK
      └── public facade
          └── runtime module or plugin
              └── browser/network primitive
```

Example: HTTP/WS-FLV → Player → `odd.player` → FLV module → IO loader + FLV parser + AAC/AVC codecs + FMP4 remuxer + MediaSource.

## Features

### Multi-instance products

Player, RTC, IM, NES, and Famicom use per-SDK `get(id)` and `create()` registries. Player, IM, NES, and Famicom UI bundles pair with core by the same id, while explicit destruction releases instance ownership.

### 24/7 low-latency Player

FLV and FMP4 bound the retained live buffer with periodic SourceBuffer eviction. Low-latency mode combines smooth 1.2x catch-up with a hard five-second correction, preventing TCP/download backlog from accumulating without bound.

### Core and UI are separately deployable

Player, IM, NES, and Famicom expose headless core bundles and optional UI bundles. The UI obtains the core instance with the same numeric id, forwards core events, and binds facade methods after `Event.BIND`. This keeps protocol/media logic usable without DOM policy while allowing a default UI.

### Ordered registries provide extension points

IO loaders, Player modules, codecs, formats, NES mappers, and UI plugins register constructors by `prototype.kind`. Selection is data-driven instead of a central switch. New implementations can join the pipeline without changing the facade.

### Facades keep object graphs private

`odd.player()`, `odd.rtc()`, `odd.im()`, `odd.nes()`, and `odd.famicom()` return stable facades from per-SDK instance registries. Internal controllers, peer connections, streams, parsers, and DOM plugins remain behind the facade.

### Events decouple layers

`EventDispatcher` supports typed listeners, global forwarding, `on<event>` callbacks, and instance ids. Player's View and Controller, SDK/UI pairs, loaders, codecs, parsers, and protocol objects use the same event envelope.

### Protocol and media responsibilities are separated

IM separates WebSocket framing (`NetConnection`), logical pipes (`NetStream`), message types, command payloads, and responders. RTC separates the SDK facade, per-session `NetStream`, constraints, statistics, beauty, metering, and mixers.

### Inputs converge before domain logic

NES and Famicom UI layers translate keyboard, pointer, touch, joystick, and gamepad input into a small core key API. Famicom reference-counts key presses, preventing one input source from releasing a key still held by another.

## Repeated patterns

| Pattern | SDKs | Benefit |
| --- | --- | --- |
| `get(id)` + `create()` instance registry | Player, RTC, IM, NES, Famicom and their UIs | Multi-instance use and stable core/UI pairing |
| `prototype.CONF` defaults | All product SDKs and plugins | Inspectable configuration composition |
| `prototype.kind` registry | Common, Player, NES, all UIs | Extensibility |
| Explicit state enum | RTC, IM, NES, Famicom | Lifecycle vocabulary |
| Core events forwarded by UI | Player, IM, NES, Famicom | UI stays an adapter |

## Architectural boundaries

- Global IIFEs and concatenation order are the module system; there are no ES module imports.
- `compile.sh` declares `/bin/sh` but uses array syntax associated with Bash, so build portability is limited.
- Registry insertion uses `index || length`; index `0` cannot currently be selected.
- `EventDispatcher` accepts listener source strings through `new Function`; treat untrusted strings as unsafe.
- There is no automated test suite or package manifest in the repository.
- Source reports version `2.5.15` while the repository commit is tagged/described as `v2.5.16`; use commit identity when a precise baseline matters.
