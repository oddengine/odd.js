<a id="rtc-sdk"></a>
# RTC SDK

[中文](rtc.zh.md) · [v3.0.00 direction](v3-style.md)

RTC is a multi-stream WHIP/WHEP SDK. `RTC` owns publishing/subscribing collections and stats scheduling. Each `NetStream` owns one PeerConnection, local or remote MediaStream, HTTP resource `Location`, candidate updates, recording helpers, and close lifecycle.

## Core and NetStream

- Factories: `odd.rtc(id?, logger?)`, `odd.rtc.create(logger?)`.
- Core: `setup(config)`, `preview(constraints, screensharing, withcamera, option)`, `publish(...)`, `play(name)`, `stop(name?)`, `destroy(reason?)`.
- Device helpers: `getDevices`, `getCameras`, `getMicrophones`, `getPlaybackDevices`, `getSupportedCodecs`.
- NetStream supports constraints, capture, preview/publish/play, track replacement, beauty/mixing/recording, `enabled(kind, value)`, `stream()`, stats, properties, state, element, and close.

WHIP/WHEP POST reads an absolute or relative `Location`; PATCH candidate and DELETE close use that resource URL. Remote tracks are attached to the NetStream video element.

## UI event/state contract

RTC Core retains its multi-stream flexibility. RTC UI builds a fixed conferencing model on top: stream 1 carries camera and microphone, while stream 2 is an independent screen share. Both use the same profile/constraint configuration but have separate publishing lifecycles.

| Control | SDK action | Root attribute |
| --- | --- | --- |
| microphone | `microphone(enable)`; if stream 1 is publishing, hang up, update `_constraints`, then call again | `microphone=on/off` |
| camera | `camera(enable)`; uses the same stop/update/republish flow as microphone | `camera=on/off` |
| sharing | `share()` publishes stream 2; `cancel()` stops only stream 2 | `sharing=on/off` |
| calling | `call()` publishes stream 1; `hangup()` stops only stream 1 | `calling=on/off` |

If camera or microphone changes while stream 1 is idle, UI only updates `_constraints`; the next `call()` uses them. `play(name)`/`stop(name?)` manage subscriptions only. `layout=right/top/grid` controls video layout. Root attributes are the sole visible-state authority; Controlbar does not mirror the same state. CSS derives appearance and layout from those attributes.

UI factories are `odd.rtc.ui(id?, logger?)` and `.create(logger?)`. UI exposes `setup`, `call`, `hangup`, `share`, `cancel`, `microphone`, `camera`, `play`, `stop`, `layout`, `theater`, `fullscreen`, `presentation`, `skin`, `element`, `resize`, and `destroy`. Dashboard Settings are ordered as Video and Audio groups. Video owns a fixed preview `video`; Preview/Save events return device and profile changes to UI, and saving rebuilds either publishing stream that was previously active.

Source: [`src/rtc`](../../../src/rtc).
