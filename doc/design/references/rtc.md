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

RTC UI registers a three-section Controlbar made from Button and Toggle components. The four primary click paths are complete:

| Control | SDK action | Root attribute |
| --- | --- | --- |
| microphone | enable/disable local audio tracks | `microphone=on/off` |
| camera | enable/disable local video tracks | `camera=on/off` |
| sharing | rebuild preview/publish with display capture | `sharing=on/off` |
| calling | switch between preview and WHIP publish | `calling=on/off` |

`layout=right/top/grid` controls video layout. CSS derives control appearance and layout from these root attributes. Sharing/calling failures restore both Toggle and root state.

UI factories are `odd.rtc.ui(id?, logger?)` and `.create(logger?)`. UI exposes `setup`, `preview`, `publish`, `play`, `stop`, `layout`, `theater`, `fullscreen`, `presentation`, `skin`, `element`, `resize`, and `destroy`.

Source: [`src/rtc`](../../../src/rtc).
