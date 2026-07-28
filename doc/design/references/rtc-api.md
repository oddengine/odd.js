# RTC interfaces and events

[中文](rtc-api.zh.md) · [RTC SDK](rtc.md) · [Common event contract](common-api.md#event-listener-contract)

The current source exposes no RTC `call()` method. Generic remote calls belong to IM; older RTC documentation that listed `call()` was stale.

## Interfaces

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
