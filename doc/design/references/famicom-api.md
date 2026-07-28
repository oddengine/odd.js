# Famicom interfaces and events

[中文](famicom-api.zh.md) · [Famicom SDK](famicom.md) · [Common event contract](common-api.md#event-listener-contract)

## Interfaces

Only the public Famicom Core and UI facades are listed here. UI plugin and component contracts are implementation details.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, netConnection?: unknown, logger?: Logger \| LoggerConfig | Returns the stable Famicom Core for `id`, creating it when absent. Implemented by `Famicom.get` and exposed as `odd.famicom`. |
| `create` | netConnection?: unknown, logger?: Logger \| LoggerConfig | Creates a Core instance using the next numeric id. |

### Core instance interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | — | Returns the registry id. |
| `setup` | container: HTMLElement, config?: FamicomConfig | Creates the receive-only video and initializes the Core. |
| `video` | — | Returns the receive-only video element. |
| `load` | game: string, mediaStreamId: string | Compatibility alias of `init`. |
| `selectPlayer` | playerSlot?: number \| string | Reads or selects the desired player slot. |
| `init` | game?: string, mediaStreamId?: string | Creates a server game instance and negotiates WebRTC. |
| `join` | instance?: string, player?: string | Joins an existing game instance and negotiates WebRTC. |
| `leave` | — | Releases the current player reservation and local peer. |
| `destroy` | reason?: string | Destroys the owned server resource, closes locally, and removes the Core instance. |
| `keyDown` | key: string | Presses a key and sends the changed controller mask. |
| `keyUp` | key: string | Releases a key and sends the changed controller mask. |
| `key` | key: string, pressed: boolean | Dispatches to `keyDown` or `keyUp`. |
| `keys` | state?: number | Reads or sets the full controller state. |
| `muted` | status?: boolean | Reads or sets video mute. |
| `state` | — | Returns the session state. |
| `getStats` | selector?: MediaStreamTrack | Returns peer statistics and emits compact video deltas. |

### UI static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable UI paired with the same-id Core. Implemented by `Famicom.UI.get` and exposed as `odd.famicom.ui`. |
| `create` | logger?: Logger \| LoggerConfig | Creates a UI instance using the next numeric id. |

### UI instance interfaces

After Core binding, the UI forwards the Core interfaces for game/session/input/media control. They are not duplicated below. The Core destructor is exposed as `destroyGame` so `destroy` can retain UI-only cleanup semantics.

| Method | Arguments | Description |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: FamicomUIConfig | Builds the UI, input polling, and paired Core. |
| `fullpage` | status?: boolean | Reads or sets page-filling mode. |
| `fullscreen` | status?: boolean | Reads or requests browser fullscreen. |
| `resize` | — | Resizes the video and UI plugins. |
| `destroyGame` | reason?: string | Invokes the forwarded Core/server destructor. |
| `destroy` | reason?: string | Removes UI/input resources and unregisters the UI. |

## Events

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`; Core events are forwarded to UI.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | Core session and media interfaces became available. |
| READY | — | The client is ready to initialize or join a game. |
| ERROR | name: string, message: string | Signaling, HTTP, SDP, peer, or session-state processing failed. |
| VOLUMECHANGE | muted: boolean, volume: number | Output audio state changed. |
| CLOSE | reason?: string | The game session closed. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | A peer-connection or media-track status notification arrived. |

### MediaEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| STATSUPDATE | stats: FamicomStats | Compact per-interval game-video statistics changed; `stats` contains `fps`, `nack`, `pli`, `droppedFrames`, `freezes`, and `interval`. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| FULLPAGE | status: boolean | Full-page mode changed. |
| FULLSCREEN | status: boolean | Browser fullscreen state changed. |
| RESIZE | width: number, height: number | The Famicom UI was resized. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | A game-control button was pressed. |
| MOUSE_UP | name: string | A game-control button was released. |
| CLICK | name: string | A named game-control button was clicked. |

### TouchEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | A joystick touch started. |
| TOUCH_MOVE | name: string, touches: TouchList | A joystick touch moved. |
| TOUCH_END | name: string | A joystick touch ended. |
| TOUCH_CANCEL | name: string | A joystick touch was cancelled. |

Keyboard and gamepad input is normalized directly into `keyDown`/`keyUp` calls and is not dispatched as a separate SDK event.

## Audit evidence

- [`famicom.js`](../../../src/famicom/famicom.js)
- [`ui.js`](../../../src/famicom/ui/ui.js)
- [`src/famicom/ui`](../../../src/famicom/ui)
