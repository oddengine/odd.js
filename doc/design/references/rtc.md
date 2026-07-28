<a id="rtc-sdk"></a>
# RTC SDK

[中文](rtc.zh.md) · [Product goals](architecture.md#target-tree) · [Architecture](architecture.md)

<!-- TOC -->
## Contents

- [Facade](#facade)
- [NetStream](#netstream)
- [Media helpers](#media-helpers)
- [Features](#features)
- [Plugins](#plugins)
- [Configuration](#configuration)
- [Interfaces](#interfaces)
  - [Core static interfaces](#core-static-interfaces)
  - [Core instance interfaces](#core-instance-interfaces)
  - [NetStream instance interfaces](#netstream-instance-interfaces)
- [Events](#events)
  - [Event](#event)
  - [NetStatusEvent](#netstatusevent)
  - [SaverEvent](#saverevent)
- [Audit evidence](#audit-evidence)
- [Signaling capability](#signaling-capability)
- [Source map](#source-map)
- [Known boundaries](#known-boundaries)
<!-- /TOC -->

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

The current source exposes no RTC `call()` method. Generic remote calls belong to IM; older RTC documentation that listed `call()` was stale.

RTC has no UI facade in the current source. The public API consists of the Core static interfaces, the Core instance facade, and the `NetStream` objects returned by preview, publish, and play.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, netConnection?: NetConnection, logger?: Logger \| LoggerConfig | Returns the stable RTC Core for `id`, creating it when absent. Implemented by `RTC.get` and exposed as `odd.rtc`. |
| `create` | netConnection?: NetConnection, logger?: Logger \| LoggerConfig | Creates an RTC Core using the next numeric id. |
| `getDevices` | logger?: Logger \| LoggerConfig | Enumerates all media devices. |
| `getCameras` | logger?: Logger \| LoggerConfig | Enumerates video-input devices. |
| `getMicrophones` | logger?: Logger \| LoggerConfig | Enumerates audio-input devices. |
| `getPlaybackDevices` | logger?: Logger \| LoggerConfig | Enumerates audio-output devices. |
| `getSupportedCodecs` | logger?: Logger \| LoggerConfig | **Skeleton:** the interface exists, but its current implementation has no result. |

### Core instance interfaces

`state` is attached by `setup()`.

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | — | Returns the registry id. |
| `setup` | config?: RTCConfig | Initializes the RTC facade and stats timer. |
| `client` | — | Returns the optional attached IM connection. |
| `preview` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | Creates and returns a local preview `NetStream`. |
| `publish` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | Creates a preview and publishes it through WHIP. |
| `unpublish` | — | Releases all publisher streams. |
| `play` | resourceId: string | Creates and returns a subscriber `NetStream`. |
| `stop` | resourceId?: string | Stops one subscriber or all subscribers. |
| `state` | — | Returns the RTC facade state. |
| `destroy` | reason?: string | Releases all streams and removes the Core instance. |

### NetStream instance interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `pid` | — | Returns the local pipe id. |
| `uuid` | — | Returns the stream UUID when present. |
| `client` | — | Returns the attached IM connection. |
| `attach` | netConnection?: NetConnection | Creates the peer connection and attaches signaling. |
| `setProperty` | key: string, value: unknown | Stores stream metadata. |
| `getProperty` | key: string | Returns stream metadata. |
| `applyConstraints` | constraints: MediaStreamConstraints | Applies constraints to existing local tracks. |
| `setCamera` | deviceId: string | Selects a camera and replaces the active video track where supported. |
| `setMicrophone` | deviceId: string | Selects a microphone in the active constraints. |
| `setProfile` | profile: string | Applies a named capture profile. |
| `setResolution` | width: number, height: number | Updates video resolution constraints. |
| `setFramerate` | fps: number | Updates video frame-rate constraints. |
| `setBitrate` | bitrate: number | Updates the maximum sending bitrate. |
| `getUserMedia` | constraints: MediaStreamConstraints | Captures camera and/or microphone media. |
| `getDisplayMedia` | constraints: DisplayMediaStreamOptions | Captures display media. |
| `addTrack` | track: MediaStreamTrack, stream: MediaStream | Adds a publishing track to the peer connection. |
| `replaceTrack` | track: MediaStreamTrack, stopprevious?: boolean | Replaces the matching sender track. |
| `removeTrack` | sender: RTCRtpSender | Removes a sender from the peer connection. |
| `createStream` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | Creates camera/microphone or composed display media. |
| `preview` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | Creates media if needed and attaches it to the video element. |
| `publish` | — | Negotiates and publishes local media through WHIP. |
| `beauty` | enable: boolean, constraints?: BeautyConstraints | Enables or disables WebGL beauty processing. |
| `beautyEnabled` | — | Returns the current beauty state. |
| `play` | resourceId: string, mode?: string | Negotiates receive-only playback through WHEP. |
| `stop` | name?: string | Stops and releases the stream. |
| `record` | filename: string, ondata?: (chunk: Blob) => void | Records the stream with `MediaRecorder`. |
| `getTransceivers` | — | Returns peer transceivers. |
| `getSenders` | — | Returns peer senders. |
| `getReceivers` | — | Returns peer receivers. |
| `volume` | — | Returns the normalized audio-meter value. |
| `getStats` | — | Returns parsed peer-connection statistics. |
| `state` | — | Returns the stream state. |
| `release` | reason?: string | Releases the remote WHIP/WHEP resource and closes locally. |
| `close` | reason?: string | Stops tracks, recording, media, and the peer connection. |

## Events

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | RTC setup completed and runtime interfaces are available. |
| READY | — | The RTC Core is ready. |
| ERROR | name: string, message: string | **Reserved on the Core:** most current failures reject their promises instead. |
| RELEASE | reason?: string | A `NetStream` released its remote and local resources; the Core consumes this event to update its stream maps. |
| CLOSE | reason?: string | **Reserved on the Core:** the close handler exists but is not currently registered. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | A publish/play status arrived, including track publish, play, unpublish, and stop notifications. |

### SaverEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | A `NetStream` recording writer opened. |
| WRITEREND | writer: StreamWriter | A `NetStream` recording writer ended. |

Native negotiation, track, ICE, and connection-state callbacks are handled internally and are not SDK event types.

## Audit evidence

- [`rtc.js`](../../../src/rtc/rtc.js)
- [`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- [`src/rtc`](../../../src/rtc)

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
