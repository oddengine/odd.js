# odd.js Product Goals

[中文](product-map.zh.md) · [SDK implementation tree](sdk-map.md) · [Architecture](architecture.md)

This tree describes what the product intends to provide. Status describes the current repository. Every leaf links to the SDK that owns its implementation; the SDK page then links to source.

## Product portfolio

- [Web media and communication SDK](sdk-map.md#clickable-tree)
  - [Player SDK](player.md#player-sdk)
  - [RTC SDK](rtc.md#rtc-sdk)
  - [IM SDK](im.md#im-sdk)
- [Browser-local NES emulator](nes.md#nes-sdk) — **Verified**
- [Famicom cloud-gaming client](famicom.md#famicom-sdk) — **Verified**

## Target tree

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

- [2.1 Encoding/codec target: H264, H265, AAC, Opus](player.md#cap-codecs) — Player + RTC — **Partial**
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
