<a id="rtc-sdk"></a>
# RTC SDK

[中文](rtc.zh.md) · [Product goals](product-map.md) · [SDK map](sdk-map.md)

Bundle: `odd.rtc`. Online: [Interactive live](https://oddengine.com/en/solution/interactive.html), [Video conference](https://oddengine.com/en/solution/conference.html), [Call](https://oddengine.com/en/solution/call.html).

<a id="facade"></a>
## Facade

`RTC` manages publisher/subscriber `NetStream` instances and periodic statistics. It can run standalone or receive an IM `NetConnection`; the latter supplies user identity while WHIP/WHEP still carries SDP and media.

<a id="netstream"></a>
## NetStream

<a id="cap-whip-whep"></a>`NetStream` creates `RTCPeerConnection`, local preview/publication, WHEP subscription, SDP codec preference, optional trickle ICE, track changes, browser recording, and cleanup.

| Path | Status | Network behavior |
| --- | --- | --- |
| WHIP publish | **Verified** | `POST application/sdp`, consume `Location`, optional PATCH trickle, DELETE on release |
| WHEP play | **Verified** | same resource lifecycle, remote track attached to an autoplay video |
| Player RTC adapter | **Verified**, with cleanup risk | converts WHEP events/state into the Player module contract |

<a id="media-helpers"></a>
## Media helpers

| Module | Role |
| --- | --- |
| `Constraints` | Named capture profiles from low resolutions to 1080P |
| `Stats` | Normalizes RTC statistics |
| `AudioMeter` | WebAudio volume measurement |
| <a id="cap-beauty"></a>`Beauty` | WebGL brightness/smoothness filter; canvas `captureStream` output |
| `Mixer`, `AudioMixer`, `VideoMixer` | Shared mixer interface and canvas/audio composition |

## Features

- **Multi-instance and multi-stream:** stable RTC instances can hold multiple concurrent publishers and subscribers.
- **Capture and composition:** camera, microphone, screen sharing, camera-over-screen video mixing, named profiles, and runtime constraints share one stream workflow.
- **Negotiation control:** ordered codec preferences, ICE configuration, optional trickle ICE, and WHIP/WHEP resource lifecycle are configurable.
- **Media processing:** dynamic tracks, WebGL beauty, audio metering, normalized stats, and browser recording are built into the SDK.
- The SDK facade owns collections while each `NetStream` owns one peer/resource lifecycle.
- WHIP/WHEP HTTP resources are separated from optional IM identity/control transport.
- Device capture, constraint updates, peer negotiation, recording, stats, beauty, and mixing live in focused helpers.
- Dynamic track methods operate on RTCRtpSender instead of rebuilding the whole SDK.
- The same stream object exposes `video`, `stream`, properties, state, and events for UI integration.

## Plugins

RTC has no separate UI bundle. `Beauty`, `AudioMeter`, and mixers are media helpers, not UI plugins. Player's `Chat` plugin consumes this SDK.

## Configuration

| Group | Keys |
| --- | --- |
| Endpoints | `whip`, `whep`, `trickle` |
| Media | `profile`, `codecpreferences` |
| Request/session | `parameters.token`, `rtcconfiguration` |
| Recording service | `service.script`, `service.scope`, `service.enable` |

`NetStream` defaults add an ICE server and `iceTransportPolicy`; capture constraints include audio/video device ids, facing mode, and cursor policy.

## Interfaces

<a id="cap-dynamic-tracks"></a>
<a id="cap-rtc-record"></a>

| Reference | Coverage |
| --- | --- |
| [Audited interface table](rtc-api.md#interfaces) | Factories/devices, RTC facade, NetStream, dynamic tracks, recording and media helpers |

## Events

| Reference | Coverage |
| --- | --- |
| [Audited event table](rtc-api.md#events) | RTC/NetStream status, release, recording and declared-but-unreached events with payloads |

## Signaling capability

<a id="cap-publish-subscribe"></a>Publish/subscribe is **Verified** through WHIP/WHEP.

<a id="cap-call-control"></a>Call/answer/reject/timeout as a product state machine is **Planned**. Generic `call()` belongs to IM and is not present on the current RTC surface.

<a id="cap-mute"></a>Mute is **Partial**: output video mute and track enablement are possible, but there is no normalized remote mute-control contract.

<a id="cap-kick"></a>Kick is **Planned** in RTC.

<a id="cap-record-signal"></a>Start/stop recording signaling is **Partial**: local recording exists, but no normalized distributed recording command/state is defined.

<a id="cap-end"></a>End is **Partial** through stop/release/DELETE; no call lifecycle abstraction exists.

## Source map

- Facade and factories: [`rtc.js`](../../../src/rtc/rtc.js)
- Peer/session implementation: [`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- Constraints/stats/media helpers: [`src/rtc`](../../../src/rtc)
- Player adapter: [`module.rtc.js`](../../../src/player/module/module.rtc.js)

## Known boundaries

- `RTC.getSupportedCodecs()` is empty.
- HTTP requests do not construct an Authorization header from `parameters.token`.
- `MediaRecorder` is created without explicit MIME negotiation; exact browser codec/container matrices are unverified.
- Beauty depends on WebGL and canvas capture support and is disabled by the Player Chat plugin on Apple WebKit.
- There are no automated negotiation, browser-matrix, or reconnect tests.
