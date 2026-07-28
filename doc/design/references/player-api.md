# Player interfaces and events

[中文](player-api.zh.md) · [Player SDK](player.md) · [Common event contract](common-api.md#event-listener-contract)

This page audits the public Core and UI facades against `src/player`, including methods attached only after `setup()`. Internal extension surfaces are intentionally excluded.

## Interfaces

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
| `danmu` | enable: boolean | Enables or disables danmu rendering. |
| `shoot` | text: string, data?: unknown | Sends a comment to the Danmu plugin. |
| `displayAD` | element: HTMLElement | Displays content through the AD plugin. |
| `removeAD` | — | Removes the content displayed by the AD plugin. |
| `fullpage` | status?: boolean | Reads or sets page-filling mode. |
| `fullscreen` | status?: boolean | Reads or requests browser fullscreen. |
| `resize` | — | Resizes the active playback view and UI plugins. |
| `destroy` | — | Removes UI resources, destroys the paired Core, and unregisters the UI. |

## Events

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`; listeners use `on<type>` or the listener interfaces documented in [Common](common-api.md#event-listener-contract). Core events are forwarded to UI.

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
| SHOOTING | text: string, data?: unknown | A danmu message was submitted. |
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
