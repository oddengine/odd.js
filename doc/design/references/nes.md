<a id="nes-sdk"></a>
# NES SDK

[中文](nes.zh.md) · [SDK map](sdk-map.md)

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

| Reference | Coverage |
| --- | --- |
| [Audited interface table](nes-api.md#interfaces) | Factories, core/UI facades, mapper registry, plugins and the internal-hardware boundary |

## Events

| Reference | Coverage |
| --- | --- |
| [Audited event table](nes-api.md#events) | Core, ROM loading, UI input and declared-but-unreached events with payloads |

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
