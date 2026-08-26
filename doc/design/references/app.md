# App SDK

[中文](app.zh.md) · [v3.0.00 direction](v3-style.md)

App is the thin composition layer for the four SDK capabilities. It uses the IM UI root Tab as the application frame and owns only section selection, skin propagation, module registration, DOM mounting, and event forwarding. Protocol, media, chat, game input, and conference actions remain in IM, Player, Famicom, and RTC.

## Screens and ownership

| Tab | Content | Right sidebar |
| --- | --- | --- |
| `contacts` | IM Contacts | most recently active media in a top-right `popup` |
| `messages` | IM Conversations + Conversation | most recently active media in a top-right `popup` |
| `play` | Player (live/VOD) | IM Conversation in `mini` presentation |
| `game` | Famicom | IM Conversation in `mini` presentation |
| `meeting` | RTC | IM Conversation in `mini` presentation |

IM creates Contacts and Messages itself; App only injects Play, Game, and Meeting into the same Tab. App does not build a second navigation system. It creates one Player instance and lets Player own live/VOD. Selecting an IM category moves the most recently active media wrapper to the top-right popup; selecting a media category restores that module to its page and moves the Conversation plugin into the sidebar. Switching only reparents existing wrappers; it does not rebuild module instances.

## API

Core factories are `odd.app(id?, logger?)` and `odd.app.create(logger?)`. Core exposes `setup(config)`, `section(value?)`, `skin(value?)`, `module(name, instance?)`, `modules()`, `state()`, and `destroy(reason?)`.

UI factories are `odd.app.ui(id?, logger?)` and `odd.app.ui.create(logger?)`. UI exposes `setup(container, config)`, `section(value?)`, `skin(value?)`, `module(name)`, `element()`, `resize()`, and `destroy(reason?)`.

`events.AppEvent` currently defines `app-section-change` and `app-skin-change`. Module events are forwarded without being translated into App-private action schemas.

Build outputs are `odd.app.min.js` and `odd.app.ui.min.js`; both are also included in `odd.min.js`.
