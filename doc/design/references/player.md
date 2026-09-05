<a id="player-sdk"></a>
# Player SDK

[中文](player.zh.md) · [Product goals](architecture.md#target-tree) · [Architecture](architecture.md)

<!-- TOC -->
## Contents

- [Core](#core)
- [Playback modules](#playback-modules)
- [Features](#features)
- [Plugins](#plugins)
- [Configuration](#configuration)
  - [Core](#core-1)
  - [UI](#ui)
- [Interfaces](#interfaces)
  - [Core static interfaces](#core-static-interfaces)
  - [Core instance interfaces](#core-instance-interfaces)
  - [UI static interfaces](#ui-static-interfaces)
  - [UI instance interfaces](#ui-instance-interfaces)
- [Events](#events)
  - [Event](#event)
  - [IOEvent](#ioevent)
  - [MediaEvent](#mediaevent)
  - [SaverEvent](#saverevent)
  - [UIEvent](#uievent)
  - [GlobalEvent](#globalevent)
  - [MouseEvent](#mouseevent)
- [Audit evidence](#audit-evidence)
- [Product capability notes](#product-capability-notes)
- [Source map](#source-map)
- [Known boundaries](#known-boundaries)
<!-- /TOC -->

Bundles: `odd.player`, optional `odd.player.ui`. Online: [Live](https://oddengine.com/en/solution/live.html), [VoD](https://oddengine.com/en/solution/vod.html).

<a id="core"></a>
## Core

`Player` is the public facade. `Model` owns sources, selected definition, duration, state, and properties; `View` owns the active playback module and media element; `Controller` owns play/reload, retries, state transitions, information, and statistics. This small MVC split keeps protocol modules independent from orchestration.

<a id="playback-modules"></a>
## Playback modules

| Module | Status | Main path |
| --- | --- | --- |
| <a id="cap-native-media"></a>SRC | **Verified** | Browser-native MPEG-4, OGG, WebM, MP3/AAC and platform-selected HLS |
| <a id="cap-flv"></a>FLV | **Verified** | HTTP/WS bytes → FLV parser → AAC/AVC → FMP4 remux → MediaSource |
| <a id="cap-cmaf"></a>FMP4 | **Verified** byte stream / **Partial** CMAF product | HTTP/WS fragmented MP4 boxes → MediaSource |
| RTC | **Verified** | WHEP playback through `odd.rtc`, adapted to Player events |
| <a id="cap-hls"></a>HLS | **Partial** | Native HLS through SRC on selected mobile/macOS Safari paths |
| <a id="cap-hls2"></a>HLS-2nd | **Planned** | No module found |
| <a id="cap-dash"></a>DASH | **Skeleton** | Common has an MPD model, but Player has no DASH module |

Module selection is an ordered registry. `Module.get(file, option)` tests the requested module and then registered `isSupported` predicates.

## Features

- **Multi-instance and dynamic lifecycle:** independent Player and UI registries provide stable `get(id)` pairing, auto-id `create()`, and explicit `destroy()`.
- **24/7 live-playback design:** FLV and FMP4 periodically remove old SourceBuffer ranges according to `maxPlaybackLength`, bounding the retained media window for long-running sessions. The mechanism is verified in source; no repository soak test proves a duration SLA.
- **No cumulative live latency:** with `lowlatency` enabled, playback accelerates to 1.2x above `maxBufferLength`, returns to 1x near `bufferLength`, and hard-corrects when latency exceeds five seconds.
- **Track-tolerant playback:** FLV metadata/flags drive audio-only, video-only, and audio-video SourceBuffer creation instead of assuming both tracks.
- **Capture, recording, and observability:** canvas screenshots, progressive FMP4 saving, media information, statistics, SEI, and writer events are exposed through one facade.
- Core/UI separation makes the playback engine usable headlessly.
- MVC keeps source policy, active module, and retry/state orchestration in separate objects.
- Ordered module, codec, format, loader, and UI-plugin registries form a consistent extension model.
- Every playback module presents the same play/pause/seek/stop/mute/volume/element contract.
- UI layouts are data strings, so components can be reordered or removed without changing plugin classes.
- Core events flow upward unchanged; UI reacts to selected events and forwards the rest.

<a id="plugins"></a>
## Plugins

Rows follow the defined product layering order: the farther down a row appears, the higher its conceptual UI layer.

| Target / current mapping | Status | Main role / configuration |
| --- | --- | --- |
| <a id="cap-content"></a>`Content` abstraction; current `Chat` mapping | **Planned abstraction / Partial mapping** | Live/WatchParty/RTC/IM target is not registered; `Chat` provides an RTC-dependent local/remote video list with `profile`, `camera`, `microphone`, `client`, `rtc`, `service`, `visibility` |
| <a id="cap-subtitle-plugin"></a>`Subtitle` | **Planned** | No parser, renderer, or plugin |
| <a id="cap-poster"></a>`Poster` | **Verified** | `file`, `cors`, `objectfit`, `visibility` |
| <a id="cap-comment"></a>`Comments` | **Verified implementation** | Moving comments; `speed`, `lineHeight`, `enable`, `visibility` |
| <a id="cap-dashboard"></a>`Dashboard` | **Implemented** | Info/Stats Panels plus Settings; the Chat group edits profile, camera, and microphone |
| `AD` | **Verified primitive** | Inserts/removes caller-provided DOM; `visibility` |
| `Share` | **Verified primitive** | Inserts caller-provided DOM; `visibility` |
| <a id="cap-logo"></a>`Logo` | **Verified** | `file`, `link`, `cors`, `target`, `style`, `visibility` |
| <a id="cap-controlbar"></a>`Controlbar` | **Verified core / Partial target controls** | Layout-driven controls; `layout`, `autohide`, `visibility` |
| <a id="cap-contextmenu"></a>`ContextMenu` | **Verified** | Configurable items plus media information/statistics; `items`, `visibility` |
| <a id="cap-sidebar"></a>`Sidebar` | **Planned** | Userlist/Playlist/Tools/Settings/Layout target is not registered |
| <a id="cap-dialog"></a>`Dialog` | **Planned** | Notify/Alert/Confirm target is not registered |

## Configuration

### Core

| Group | Keys |
| --- | --- |
| Playback | `airplay`, `autoplay`, `file`, `loop`, `mode`, `module`, `muted`, `objectfit`, `playsinline`, `preload`, `volume` |
| Buffer/retry | `bufferLength`, `maxBufferLength`, `maxPlaybackLength`, `lowlatency`, `maxRetries`, `retrying` |
| Source policy | `sources[]` with `file`, `module`, `loader`, `default`, `label`; top-level `loader` |
| Integration | `im`, `rtc`, `service` |
| Declared but not wired end-to-end | `dynamic`, `smoothing` |

`loader` includes `name`, `mode`, and `credentials`. `service` includes `script`, `scope`, and `enable`.

### UI

`aspectratio` (deprecated), `client`, `skin`, and `plugins[]`, merged with the full core configuration.

<a id="cap-skins"></a>The UI adds `pe-ui-<skin>` at setup. Only the classic skin and setup-time selection are visible; runtime one-click switching is **Partial**.

## Interfaces

<a id="cap-instances"></a>

Both core and UI expose same-id `get/create` registries: multi-instance use is **Verified**.

This page audits the public Core and UI facades against `src/player`, including methods attached only after `setup()`. Internal extension surfaces are intentionally excluded.

Only the public Core and UI facades are listed here. Playback-module, codec, format, plugin, component, and other registration contracts are implementation details rather than Player SDK instance APIs.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable Core instance for `id`, creating it when absent. Implemented by `Player.get` and exposed as `odd.player`. |
| `create` | logger?: Logger \| LoggerConfig | Creates a Core instance using the next numeric id. |

### Core instance interfaces

Methods from `play` through `state` are attached after `setup()` binds the Core.

| Method | Arguments | Description |
| --- | --- | --- |
| `setup` | container: HTMLElement, config?: PlayerConfig | Creates and binds the playback model, view, and controller. |
| `play` | file?: string, option?: PlaybackOptions | Selects a source/module or resumes paused playback. |
| `pause` | — | Pauses the active playback module. |
| `seek` | offset: number | Seeks the active playback module. |
| `stop` | — | Stops playback and clears the active source state. |
| `reload` | — | Reloads the current source. |
| `muted` | status?: boolean | Reads or sets mute state. |
| `volume` | value?: number | Reads or sets output volume. |
| `definition` | index?: number | Reads or changes the selected definition. |
| `capture` | width?: number, height?: number, mime?: string | Captures the current frame and emits `screenshot`. |
| `record` | filename: string | Starts recording when the active playback module supports it. |
| `element` | — | Returns the active rendering element. |
| `getProperty` | key: string | Returns metadata/model data stored under `key`. |
| `duration` | — | Returns media duration in seconds. |
| `state` | — | Returns the current playback state. |
| `destroy` | — | Destroys playback resources and removes the Core instance. |

### UI static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable UI instance paired with the same-id Core. Implemented by `Player.UI.get` and exposed as `odd.player.ui`. |
| `create` | logger?: Logger \| LoggerConfig | Creates a UI instance using the next numeric id. |

### UI instance interfaces

After Core binding, the UI also forwards the Core instance interfaces above. They are intentionally not duplicated in this table.

| Method | Arguments | Description |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: PlayerUIConfig | Builds the UI and initializes the paired Core. |
| `chat` | enable: boolean | Enables or disables the chat UI when the plugin is installed. |
| `comments` | enable: boolean | Enables or disables moving comments. |
| `comment` | text: string, data?: unknown | Sends a moving comment to the Comments plugin. |
| `displayAD` | element: HTMLElement | Displays content through the AD plugin. |
| `removeAD` | — | Removes the content displayed by the AD plugin. |
| `fullpage` | status?: boolean | Reads or sets page-filling mode. |
| `fullscreen` | status?: boolean | Reads or requests browser fullscreen. |
| `resize` | — | Resizes the active playback view and UI plugins. |
| `destroy` | — | Removes UI resources, destroys the paired Core, and unregisters the UI. |

## Events

<a id="cap-events"></a>

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`; listeners use `on<type>` or the listener interfaces documented in [Common](common.md#event-listener-contract). Core events are forwarded to UI.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | The Core or UI facade has finished attaching its runtime interfaces. |
| READY | kind: string | The active playback module is ready. |
| PLAY | — | Playback started or resumed. |
| WAITING | — | Playback is waiting for more media data. |
| DURATIONCHANGE | duration: number | Media duration changed. |
| LOADEDMETADATA | metadata: unknown | Media metadata was loaded. |
| LOADEDDATA | — | Data for the current frame was loaded. |
| CANPLAY | — | Enough data is available to begin playback. |
| PLAYING | — | Playback is progressing after pause or buffering. |
| CANPLAYTHROUGH | — | The browser estimates that playback can continue without buffering. |
| PAUSE | timestamp: number | Playback paused. |
| SEEKING | timestamp: number | A seek operation started. |
| SEEKED | timestamp: number | A seek operation completed. |
| SWITCHING | index: number | A manual definition switch started. |
| SWITCHED | index: number | **Reserved:** declared and forwarded, but no current dispatch was found. |
| RATECHANGE | rate: number | Playback rate changed, including low-latency catch-up. |
| TIMEUPDATE | start: number, time: number, buffered: number, duration: number | Playback position or buffered range changed; fields depend on the module. |
| VOLUMECHANGE | muted: boolean, volume: number | Mute or output volume changed. |
| ENDED | — | The media reached its end. |
| ERROR | name: string, message: string | Playback, selection, parsing, MSE, or capture failed. |

### IOEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| LOADSTART | — | Resource loading started. |
| OPEN | — | The underlying transport opened. |
| PROGRESS | buffer: ArrayBuffer, loaded: number, total: number | Incremental resource data arrived. |
| SUSPEND | — | Resource loading was suspended. |
| STALLED | — | Resource loading stalled. |
| ABORT | — | Resource loading was aborted. |
| TIMEOUT | — | Resource loading timed out. |
| LOAD | — | The resource loaded successfully. |
| LOADEND | — | The loading lifecycle ended. |

### MediaEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| INFOCHANGE | info: MediaInfo | Media or container information changed. |
| STATSUPDATE | stats: MediaStats | Runtime media statistics changed. |
| SEI | packet: Packet, nalu: NALUnit | An H264 supplemental enhancement information unit was detected. |
| SCREENSHOT | image: string | `capture` produced an image data URL. |

### SaverEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | The recording writer opened. |
| WRITEREND | writer: StreamWriter | The recording writer ended. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| SHOOTING | text: string, data?: unknown | A moving comment was submitted. |
| FULLPAGE | status: boolean | Full-page mode changed. |
| FULLSCREEN | status: boolean | Browser fullscreen state changed. |
| RESIZE | width: number, height: number | The Player UI was resized. |

### GlobalEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | A named UI value changed. |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | A named panel became `visible` or `hidden`. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | A named UI target was clicked. |
| DOUBLE_CLICK | name: string | A named UI target was double-clicked. |
| MOUSE_MOVE | name: string, value?: unknown | The pointer moved over a named UI target. |

`KeyboardEvent` is defined by Common but is not bound by the current Player UI.

## Audit evidence

- Facade: [`player.js`](../../../src/player/player.js)
- View interface and capture: [`player.view.js`](../../../src/player/player.view.js)
- UI forwarding: [`ui.js`](../../../src/player/ui/ui.js)
- Event dispatches: [`src/player`](../../../src/player)

## Product capability notes

- <a id="cap-subtitles"></a>TTML/WebVTT/SRT subtitles: **Planned**.
- <a id="cap-buffer"></a>Smart buffer: **Verified** for FLV/FMP4. Playback starts near `bufferLength`, accelerates above `maxBufferLength`, and trims beyond `maxPlaybackLength`.
- <a id="cap-abr"></a>BOLA-E ABR: **Planned**. Manual definition selection is not ABR.
- <a id="cap-resume"></a>Breakpoint download: **Partial** transport foundation; modules do not persist offsets/entity identity or resume parser state.
- <a id="cap-capture"></a>JPG/PNG capture: **Verified** through canvas `toDataURL(mime)`.
- <a id="cap-record"></a>Recording: FLV/FMP4 streaming save is **Verified**; SRC and Player's RTC adapter reject recording. Exact Chrome/Safari MIME matrices are not negotiated here.

## Source map

- Facade/MVC: [`player.js`](../../../src/player/player.js), [`player.model.js`](../../../src/player/player.model.js), [`player.view.js`](../../../src/player/player.view.js), [`player.controller.js`](../../../src/player/player.controller.js)
- Playback modules: [`src/player/module`](../../../src/player/module)
- AV pipeline: [`src/player/av`](../../../src/player/av)
- UI/plugins: [`src/player/ui`](../../../src/player/ui)

## Known boundaries

- FMP4 recording calls `_writer.write(segment)` where `segment` is not defined in that scope.
- Player RTC module destruction references `_sourceTimer` and `_onSourceTimer`, which are not declared there.
- FLV and FMP4 both accept an empty extension, making registry order significant.
- No end-to-end DASH/HLS JavaScript playback, subtitle, ABR, or durable breakpoint-resume path exists.
