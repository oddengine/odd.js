# odd.js SDK Map

[中文](sdk-map.zh.md) · [Architecture](architecture.md)

Status: **Verified**, **Partial**, **Skeleton**, **Planned**, **Risk**.

## Clickable tree

- [odd.js aggregate](architecture.md#distribution)
  - [Common SDK](common.md#common-sdk) — `odd.common`
    - [Interfaces and events](common-api.md)
    - [Utilities](common.md#utilities)
    - [Events](common.md#events)
    - [IO loaders](common.md#io)
    - [MPD model](common.md#mpd)
  - [Player SDK](player.md#player-sdk)
    - [Interfaces and events](player-api.md)
    - [Core and MVC](player.md#core)
    - [Playback modules](player.md#playback-modules)
      - SRC — **Verified**
      - FLV — **Verified**
      - FMP4/CMAF — **Verified**
      - RTC/WHEP — **Verified**
      - DASH — **Skeleton**
      - HLS JavaScript module — **Planned**; native HLS is **Partial**
    - [AV pipeline](player.md#av-pipeline)
    - [UI framework and plugins](player.md#plugins)
  - [RTC SDK](rtc.md#rtc-sdk)
    - [Interfaces and events](rtc-api.md)
    - [Facade](rtc.md#facade)
    - [NetStream](rtc.md#netstream)
    - [Media helpers](rtc.md#media-helpers)
  - [IM SDK](im.md#im-sdk)
    - [Interfaces and events](im-api.md)
    - [Facade](im.md#facade)
    - [Transport and protocol](im.md#transport-and-protocol)
    - [UI framework and plugins](im.md#plugins)
  - [NES SDK](nes.md#nes-sdk)
    - [Interfaces and events](nes-api.md)
    - [Emulation core](nes.md#emulation-core)
    - [Mapper registry](nes.md#mapper-registry)
    - [UI framework and plugins](nes.md#plugins)
  - [Famicom SDK](famicom.md#famicom-sdk)
    - [Interfaces and events](famicom-api.md)
    - [Cloud game client](famicom.md#cloud-game-client)
    - [Input and statistics](famicom.md#input-and-statistics)
    - [UI framework and plugins](famicom.md#plugins)

## Bundle tree

```text
odd.common
├── odd.player ───── odd.player.ui
├── odd.rtc
├── odd.im ───────── odd.im.ui
├── odd.nes ──────── odd.nes.ui
└── odd.famicom ──── odd.famicom.ui

all entries above ── release/odd.js
```

Every product SDK depends on `odd.common`. Player's RTC playback module and Chat plugin additionally depend on `odd.rtc`; IM and RTC can share an IM `NetConnection`.
