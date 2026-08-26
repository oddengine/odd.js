<a id="famicom-sdk"></a>
# Famicom SDK

[中文](famicom.zh.md) · [v3.0.00 direction](v3-style.md)

Famicom receives cloud-game audio/video through WebRTC and sends controller state through an unordered, short-lived DataChannel. Core owns session signaling and input; UI owns keyboard, Gamepad, mobile Display controls, layout, and presentation.

## Location-based session API

`load(game, controllers?)` calls `play(base + '/play?game=' + game)` and requests that controller count when provided; omission means one. `play(url)` remains the single session entry:

| URL query | POST meaning |
| --- | --- |
| `game` | Create a game instance and player |
| `game + instance` | Join the instance as a new player |
| `game + instance + player` | Reconnect the named player after refresh |
| optional `controllers=1..4` | Controller slots requested by a new player connection; reconnect preserves its prior slots |

The server responds with an absolute `Location` containing `game`, `instance`, `player`, and `ports`; `ports` is a comma-separated, potentially non-contiguous slot list. The SDK stores it briefly for refresh reconnect. A transport disconnect retains the player and its ports during the reconnect grace period. PATCH uses the same URL for trickle candidates, while explicit DELETE removes the player connection and releases all of its slots. Removing `player` and `ports` before DELETE destroys the instance.

Game names are product-constrained English names and are appended directly. The SDK does not call `encodeURIComponent` or add a duplicate client validator.

## Input

`Port.P1..P4` are `0..3`. `Key` is a bit mask for directions, Start, Select, B, and A. Every DataChannel message is exactly two bytes:

```text
byte 0: port
byte 1: keys bit mask
```

A PeerConnection may own multiple ports. UI maps local keyboard/Gamepad indexes through the Location `ports` list before calling `keyDown(port, key)` / `keyUp(port, key)`; mobile Display controls use the first allocated port. The server accepts input only for ports assigned to that connection. Controlbar direction/action entries are Labels that explain keyboard bindings; pointer input is accepted only by the mobile Display controls.

## Core API

- Factories: `odd.famicom(id?, logger?)`, `odd.famicom.create(logger?)`.
- Lifecycle: `setup(container, config)`, `load(game, controllers?)`, `play(url?)`, `stop()`, `destroy(reason?)`.
- Session/input/media: `location()`, `ports()`, `keyDown(port, key)`, `keyUp(port, key)`, `muted(value?)`, `state()`, `element()`, `resize(width, height)`.
- Config includes `base`, `channel`, `trickle`, `configuration`, media element values, loader policy, and volume/mute defaults.

## UI

Factories are `odd.famicom.ui(id?, logger?)` and `.create(logger?)`. UI binds Core methods, registers Display and Controlbar plugins, polls Gamepads, releases held input on blur/visibility loss, and exposes presentation/theater/fullscreen/skin/resize/destroy.

Source: [`src/famicom`](../../../src/famicom). Server counterpart: odd.d `HttpGameHandler` and `FamicomPlayer`.
