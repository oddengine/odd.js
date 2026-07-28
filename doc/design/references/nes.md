<a id="nes-sdk"></a>
# NES SDK

[中文](nes.zh.md) · [Architecture](architecture.md)

<!-- TOC -->
## Contents

- [Emulation core](#emulation-core)
- [Mapper registry](#mapper-registry)
- [Features](#features)
- [Plugins](#plugins)
- [Configuration](#configuration)
- [Interfaces](#interfaces)
  - [Core static interfaces](#core-static-interfaces)
  - [Core instance interfaces](#core-instance-interfaces)
  - [UI static interfaces](#ui-static-interfaces)
  - [UI instance interfaces](#ui-instance-interfaces)
- [Events](#events)
  - [Event](#event)
  - [IOEvent](#ioevent)
  - [MediaEvent](#mediaevent)
  - [UIEvent](#uievent)
  - [MouseEvent](#mouseevent)
  - [TouchEvent](#touchevent)
  - [KeyboardEvent](#keyboardevent)
- [Audit evidence](#audit-evidence)
- [Source map](#source-map)
- [Known boundaries](#known-boundaries)
<!-- /TOC -->

Bundles: `odd.nes`, optional `odd.nes.ui`. This is a local browser emulator, distinct from the Famicom cloud-gaming SDK.

<a id="emulation-core"></a>
## Emulation core

| Module | Responsibility |
| --- | --- |
| `NES` | Lifecycle, frame timer, canvas/audio output, component wiring |
| `CPU` + opdata | 6502 execution and opcode metadata |
| `PPU` + name/palette/tile helpers | Scanlines, sprites, palettes, frame output |
| `APU` + channel classes | DMC, noise, square, triangle audio |
| `ROM` | iNES parsing and mapper metadata |
| `Keyboard` | Two-controller key state |

<a id="mapper-registry"></a>
## Mapper registry

The registry includes mapper ids 000, 001, 002, 003, 004, 005, 007, 011, 034, and 066. `Mapper.get(id)` selects a cartridge implementation without changing CPU/PPU/APU code.

## Features

- **Multi-instance local emulation:** each instance owns an independent canvas, audio context path, CPU, PPU, APU, ROM, mapper, and controller state.
- **Cartridge coverage:** the mapper registry supports ten mapper ids without branching the hardware core.
- **Two-controller input:** keyboard, mouse, touch, and joystick UI input maps into the same controller model.
- **Runtime control:** ROM load/reload, start/stop/reset, mute, frame output, audio output, and FPS reporting are exposed by the core.
- Hardware domains are separate objects connected by the `NES` coordinator.
- Mapper variability is isolated behind a registry.
- Frame execution and one-second FPS reporting use independent timers.
- Core/UI separation keeps ROM execution independent from network loading and controls.
- UI translates keyboard, touch, mouse, and joystick gestures into the same two-controller keyboard model.

<a id="plugins"></a>
## Plugins

| Plugin | Status | Configuration |
| --- | --- | --- |
| `Controlbar` | **Verified controls / Partial actions** | `layout`, `visibility`, inherited joystick config |

Controlbar exposes joystick, reload, capture, mute/unmute, Select, Start, B, and A. Reload and capture click handlers are empty, so those two visible actions are **Skeleton**.

UI components: Button, JoyStick, Label.

## Configuration

| Layer | Keys |
| --- | --- |
| Core | `drawFrame`, `frameRate`, `muted`, `sampleRate` |
| UI | `skin`, per-controller `keyboard` maps, `plugins[]` |
| Loader option | Passed to Common XHR while loading the ROM |

## Interfaces

This page audits the public emulator Core and UI facades. Mapper/plugin contracts and CPU/PPU/APU objects remain internal implementation surfaces.

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

## Source map

- Coordinator: [`nes.js`](../../../src/nes/nes.js)
- CPU/PPU/APU/ROM/keyboard: [`src/nes`](../../../src/nes)
- Mapper implementations: [`src/nes/mapper`](../../../src/nes/mapper)
- UI/plugin/components: [`src/nes/ui`](../../../src/nes/ui)

## Known boundaries

- ROM Mapper coverage is finite; unsupported mapper ids reject loading.
- Audio buffers are scheduled immediately per write rather than through a long-lived queue.
- UI reload and capture buttons have no implementation.
- NES UI teardown does not remove every DOM listener it installs.
