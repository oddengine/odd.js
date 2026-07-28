<a id="player-sdk"></a>
# Player SDK

[中文](player.zh.md) · [Product goals](product-map.md) · [SDK map](sdk-map.md)

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

<a id="av-pipeline"></a>
## AV pipeline

- Codec registry: `AAC` and `AVC`.
- Format registry: incremental `FLV` parser and `FMP4` parser/remux structures.
- FLV and FMP4 modules own MediaSource/SourceBuffer lifecycle, buffering, stats, and saving.
- <a id="cap-codecs"></a>H264/AAC parsing and remuxing are **Verified**. H265 and Opus are browser/RTC negotiation concerns here, not Player encoders.

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

| Plugin | Status | Main role / configuration |
| --- | --- | --- |
| <a id="cap-poster"></a>`Poster` | **Verified** | `file`, `cors`, `objectfit`, `visibility` |
| `Chat` | **Verified**, RTC-dependent | local/remote video list; `client`, `rtc`, `service`, `visibility` |
| <a id="cap-comment"></a>`Danmu` | **Verified** current implementation | comment motion; `speed`, `lineHeight`, `enable`, `visibility` |
| <a id="cap-dashboard"></a>`Display` | **Verified** | state/error, metadata and stats panels; `layout`, `ondoubleclick`, `visibility` |
| `AD` | **Verified primitive** | inserts/removes caller-provided DOM; `visibility` |
| `Share` | **Verified primitive** | inserts caller-provided DOM; `visibility` |
| <a id="cap-logo"></a>`Logo` | **Verified** | `file`, `link`, `cors`, `target`, `style`, `visibility` |
| <a id="cap-controlbar"></a>`Controlbar` | **Verified** | layout-driven controls; `layout`, `autohide`, `visibility` |
| <a id="cap-contextmenu"></a>`ContextMenu` | **Verified** | configurable items plus media info/stats; `items`, `visibility` |
| <a id="cap-content"></a>`Content` abstraction | **Planned** | Live/WatchParty/RTC/IM target is not a registered plugin |
| <a id="cap-subtitle-plugin"></a>`Subtitle` | **Planned** | no parser, renderer, or plugin |
| <a id="cap-sidebar"></a>`Sidebar` | **Planned** | Userlist/Playlist/Tools/Settings/Layout target is not registered |
| <a id="cap-dialog"></a>`Dialog` Notify/Alert/Confirm | **Planned** | IM's conversation Dialog is a different component |

### Controlbar components

Timebar; play/pause/reload/stop; live quote and time; report; capture/download; dial/hangup; mute/unmute and volume; definition; danmu; fullpage/fullscreen. Controls are omitted when platform support or configuration makes them unavailable.

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

| Reference | Coverage |
| --- | --- |
| [Audited interface table](player-api.md#interfaces) | Factories, registries, Player/UI instances, playback modules, plugins, AV stream extension surface |

Both core and UI expose same-id `get/create` registries: multi-instance use is **Verified**.

## Events

<a id="cap-events"></a>

| Reference | Coverage |
| --- | --- |
| [Audited event table](player-api.md#events) | Player, transport, media, saving, UI and declared-but-unreached events with payloads |

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
