# odd.js Architecture

[中文](architecture.zh.md)

<!-- TOC -->
## Contents

- [Product portfolio](#product-portfolio)
- [Target tree](#target-tree)
  - [1. Modules](#1-modules)
  - [2. Functions](#2-functions)
  - [3. Plugins](#3-plugins)
- [Bundle tree](#bundle-tree)
- [Features](#features)
  - [Multi-instance products](#multi-instance-products)
  - [24/7 low-latency Player](#247-low-latency-player)
  - [Core and UI are separately deployable](#core-and-ui-are-separately-deployable)
  - [Ordered registries provide extension points](#ordered-registries-provide-extension-points)
  - [Facades keep object graphs private](#facades-keep-object-graphs-private)
  - [Events decouple layers](#events-decouple-layers)
  - [Protocol and media responsibilities are separated](#protocol-and-media-responsibilities-are-separated)
  - [Inputs converge before domain logic](#inputs-converge-before-domain-logic)
- [Repeated patterns](#repeated-patterns)
- [Architectural boundaries](#architectural-boundaries)
<!-- /TOC -->

## Product portfolio

- [Web media and communication SDK](#bundle-tree)
  - [Player SDK](player.md#player-sdk)
  - [RTC SDK](rtc.md#rtc-sdk)
  - [IM SDK](im.md#im-sdk)
- [Browser-local NES emulator](nes.md#nes-sdk) — **Verified**
- [Famicom cloud-gaming client](famicom.md#famicom-sdk) — **Verified**

## Target tree

This tree describes what the product intends to provide. Status describes the current repository. Every leaf links to the SDK that owns its implementation; the SDK page then links to source.

### 1. Modules

- [1.1 HTTP MPEG-4 / OGG / WebM](player.md#cap-native-media) — Player / SRC — **Verified**
- [1.2 HTTP/WS-FLV](player.md#cap-flv) — Player / FLV — **Verified**
- [1.3 HTTP/WS-CMAF](player.md#cap-cmaf) — Player / FMP4 — **Partial CMAF**
- [1.4 HLS](player.md#cap-hls) — Player / SRC native path — **Partial**
- [1.5 HLS-2nd](player.md#cap-hls2) — Player target — **Planned**
- [1.6 MPEG-DASH](player.md#cap-dash) — Common MPD + Player target — **Skeleton**
- [1.7 WHIP/WHEP](rtc.md#cap-whip-whep) — RTC + Player RTC adapter — **Verified core**
  - [1.7.1 Real-time signaling](im.md#product-signaling-capability)
    - [Instant messaging](im.md#cap-im) — IM — **Verified**
    - [Publish / subscribe](rtc.md#cap-publish-subscribe) — RTC — **Verified**
    - [Call / answer / reject / timeout](rtc.md#cap-call-control) — RTC/IM target — **Planned state machine**
    - [Mute](rtc.md#cap-mute) — RTC/IM — **Partial**
    - [Kick](rtc.md#cap-kick) — RTC/IM target — **Planned**
    - [Start / stop recording](rtc.md#cap-record-signal) — RTC — **Partial**
    - [End](rtc.md#cap-end) — RTC — **Partial**
    - [Custom messages](im.md#cap-custom-message) — IM — **Verified**
  - [1.7.2 Dynamic tracks](rtc.md#cap-dynamic-tracks) — RTC — **Verified**
  - [1.7.3 Beauty / skin smoothing](rtc.md#cap-beauty) — RTC — **Verified**

### 2. Functions

- [2.1 Encoding/codec target: H264, H265, AAC, Opus](player.md#playback-modules) — Player + RTC — **Partial**
- [2.2 Subtitles: TTML, WebVTT, SRT](player.md#cap-subtitles) — Player — **Planned**
- [2.3 Smart buffer: play, speed-up, cleanup thresholds](player.md#cap-buffer) — Player / FLV/FMP4 — **Verified**
- [2.4 Adaptive bitrate: BOLA-E](player.md#cap-abr) — Player target — **Planned**
- [2.5 Breakpoint download: HTTP-FLV, HTTP-FMP4, HTTP-CMAF](player.md#cap-resume) — Common IO + Player — **Partial foundation**
- [2.6 Screenshot: JPG/PNG](player.md#cap-capture) — Player — **Verified**
- [2.7 Recording](player.md#cap-record) — Player + RTC — **Partial product matrix**
  - [2.7.1 Chrome: WebM with VP8/VP9/AVC1/Opus/PCM](rtc.md#cap-rtc-record) — RTC browser recorder — **Unverified matrix**
  - [2.7.2 Safari: MP4 with AVC1/MP4A](rtc.md#cap-rtc-record) — RTC browser recorder — **Unverified matrix**
- [2.8 Event callbacks](player.md#cap-events) — Common events + product SDKs — **Broad, with named gaps**
- [2.9 Multiple instances](player.md#cap-instances) — all SDK facades — **Verified**
- [2.10 One-click skin switching](player.md#cap-skins) — Player UI — **Partial**

### 3. Plugins

- [3.1 Content](player.md#cap-content) — Player UI target — **Planned abstraction**
  - [3.1.1 Live](player.md#cap-content) — current Player playback mapping — **Partial**
  - [3.1.2 WatchParty](player.md#cap-content) — Player + IM target — **Partial building blocks**
  - [3.1.3 RTC](player.md#cap-content) — Player Chat + RTC mapping — **Partial**
  - [3.1.4 IM](player.md#cap-content) — IM bundle mapping — **Partial**
- [3.2 Subtitle](player.md#cap-subtitle-plugin) — **Planned**
- [3.3 Poster](player.md#cap-poster) — `Poster` — **Verified**
- [3.4 Comment](player.md#cap-comment) — current `Danmu` — **Verified implementation / naming mismatch**
- [3.5 Dashboard](player.md#cap-dashboard) — current `Display` — **Partial target mapping**
  - [3.5.1 Metadata](player.md#cap-dashboard) — **Verified**
  - [3.5.2 Stats: first frame, rate, dropped frames](player.md#cap-dashboard) — **Verified**
- [3.6 Logo](player.md#cap-logo) — **Verified**
- [3.7 ControlBar](player.md#cap-controlbar) — **Verified core / partial target controls**
- [3.8 ContextMenu](player.md#cap-contextmenu) — **Verified**
- [3.9 Sidebar](player.md#cap-sidebar) — **Planned**
  - [3.9.1 Userlist: call, mute, enlarge](player.md#cap-sidebar) — **Planned**
  - [3.9.2 Playlist](player.md#cap-sidebar) — **Planned**
  - [3.9.3 Tools](player.md#cap-sidebar) — **Planned composition**
  - [3.9.4 Settings](player.md#cap-sidebar) — **Skeletons exist in current UIs**
    - [3.9.4.1 Layout: main, split, grid](player.md#cap-sidebar) — **Planned**
- [3.10 Dialog](player.md#cap-dialog) — **Planned target abstraction**
  - [3.10.1 Notify](player.md#cap-dialog) — **Planned**
  - [3.10.2 Alert](player.md#cap-dialog) — **Planned**
  - [3.10.3 Confirm](player.md#cap-dialog) — **Planned**

## Bundle tree

```text
odd.js
├── odd.common
├── odd.im ───────── odd.im.ui
├── odd.rtc
├── odd.player ───── odd.player.ui
├── odd.nes ──────── odd.nes.ui
└── odd.famicom ──── odd.famicom.ui
```

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
