# NES interfaces and events

[中文](nes-api.zh.md) · [NES SDK](nes.md) · [Common event contract](common-api.md#event-listener-contract)

This page audits the public emulator Core and UI facades. Mapper/plugin contracts and CPU/PPU/APU objects remain internal implementation surfaces.

## Interfaces

Only the public NES Core and UI facades are listed here. Mapper registration, CPU/PPU/APU objects, UI plugins, and components are implementation surfaces.

### Core static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable NES Core for `id`, creating it when absent. Implemented by `NES.get` and exposed as `odd.nes`. |
| `create` | logger?: Logger \| LoggerConfig | Creates a Core instance using the next numeric id. |

### Core instance interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | — | Returns the registry id. |
| `setup` | container: HTMLElement, config?: NESConfig | Initializes canvas, audio, emulator hardware, input, and timers. |
| `load` | buffer: ArrayBuffer | Parses a ROM, installs its mapper, and resets the emulator. |
| `start` | — | Starts frame execution. |
| `stop` | — | Stops frame and audio scheduling. |
| `reset` | — | Resets the emulator and starts execution. |
| `reload` | — | Reloads the retained ROM. |
| `muted` | status?: boolean | Reads or sets audio mute. |
| `writeAudio` | samples: Float32Array \| number[] | Writes one generated audio buffer; exposed for the APU callback. |
| `writeFrame` | buffer: Uint32Array, previousBuffer: Uint32Array | Draws changed pixels; exposed for the PPU callback. |
| `state` | — | Returns the emulator state. |
| `destroy` | reason?: string | Stops and closes resources, then removes the Core instance. |

### UI static interfaces

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | Returns the stable UI paired with the same-id Core. Implemented by `NES.UI.get` and exposed as `odd.nes.ui`. |
| `create` | logger?: Logger \| LoggerConfig | Creates a UI instance using the next numeric id. |

### UI instance interfaces

After Core binding, the UI forwards `start`, `stop`, `reset`, `reload`, `muted`, and `state`; those methods are not duplicated below.

| Method | Arguments | Description |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: NESUIConfig | Builds the UI and initializes the paired Core. |
| `load` | file: string, option?: LoaderOptions | Loads a ROM and passes its buffer to the Core. |
| `resize` | — | Resizes the canvas and UI plugins. |
| `destroy` | reason?: string | Aborts loading, removes UI resources, destroys the Core, and unregisters the UI. |

## Events

All callbacks receive `{ type, data, target, srcElement, ... }`. The Properties column names fields inside `event.data`; Core and loader events are forwarded to UI.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | Emulator hardware and runtime interfaces have been wired. |
| READY | — | The emulator is ready for a ROM. |
| ERROR | name: string, message: string | ROM, mapper, CPU opcode, or runtime processing failed. |
| VOLUMECHANGE | muted: boolean, volume: number | Emulator audio mute state changed. |
| CLOSE | reason?: string | **Reserved:** the event is bound, but no explicit Core dispatch was found. |

### IOEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| LOADSTART | — | ROM loading started. |
| OPEN | — | The ROM transport opened. |
| PROGRESS | buffer: ArrayBuffer, loaded: number, total: number | ROM bytes arrived; the completed buffer is passed to the Core. |
| SUSPEND | — | ROM loading was suspended. |
| STALLED | — | ROM loading stalled. |
| ABORT | — | ROM loading was aborted. |
| TIMEOUT | — | ROM loading timed out. |
| LOAD | — | The ROM loaded successfully. |
| LOADEND | — | The ROM loading lifecycle ended. |

### MediaEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| INFOCHANGE | info: { fps: number } | Emulator frame-rate information changed. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| RESIZE | width: number, height: number | The NES UI was resized. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | A virtual controller button was pressed. |
| MOUSE_UP | name: string | A virtual controller button was released. |
| CLICK | name: string | A named UI control was clicked. |

### TouchEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | A virtual-controller touch started. |
| TOUCH_MOVE | name: string, touches: TouchList | A virtual-controller touch moved. |
| TOUCH_END | name: string | A virtual-controller touch ended. |
| TOUCH_CANCEL | name: string | A virtual-controller touch was cancelled. |

### KeyboardEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| KEY_DOWN | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **Reserved:** bound by UI, while current native handlers drive the controller without dispatching this SDK event. |
| KEY_UP | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **Reserved:** bound by UI, while current native handlers drive the controller without dispatching this SDK event. |
| KEY_PRESS | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **Reserved:** bound by UI, but no current dispatch was found. |

## Audit evidence

- [`nes.js`](../../../src/nes/nes.js)
- [`ui.js`](../../../src/nes/ui/ui.js)
- [`src/nes/mapper`](../../../src/nes/mapper)
