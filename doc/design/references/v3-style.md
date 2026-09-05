# v3.0.00 Style and Design Direction

[中文](v3-style.zh.md) · [Architecture](architecture.md)

## Framework ownership

odd.js is a framework SDK family. IM owns chat, Player owns live/VOD playback, Famicom owns cloud-gaming sessions and input, and RTC owns capture, publishing, subscription, and conference controls. Plugins complete the capability inside their owning module. App creates and presents those module UIs; it does not duplicate their controls or state machines.

## Event and state flow

The common UI flow is:

```text
component semantic event
    → module UI coordinator
    → core SDK / stream operation
    → module-root state attribute
    → CSS presentation
```

Root attributes are the visible-state authority. RTC uses `microphone`, `camera`, `sharing`, `calling`, and `layout`; media/game UIs use the same approach for `state`, `muted`, `controls`, `theater`, `fullscreen`, and `presentation`. Do not mirror one state in booleans, Controlbar, and ad-hoc classes. On asynchronous failure, restore the root attribute directly from actual SDK state.

## APIs and vocabulary

- Keep mature, aggregated entry points. Famicom `play(url)` expresses create, join, and reconnect through `game`, `instance`, and `player` query parameters.
- IM connection lifecycle consists only of `setup()` and `destroy()`. Setup connects and attaches the messaging stream so callers can send immediately afterward; do not add a second public connect entry.
- Preserve protocol vocabulary. A server-provided HTTP `Location` remains `location` in code and is the authoritative URL for subsequent POST, PATCH, and DELETE operations.
- Do not add aliases, validation, adapters, or one-use error/helper wrappers without an independent invariant or reusable boundary.
- Enforce untrusted input at its authoritative boundary. Do not repeat product constraints, such as English game names, in every client layer.

## Source and CSS organization

- JavaScript keeps the global `odd` namespace, IIFE files, constructor closures, private underscore names, public `_this` methods, `prototype.kind/CONF`, and ordered registration.
- Plugins are lightweight coordinators. UI entities with independent contracts generally belong in `ui/components`; simple entries owned by one list may be managed incrementally by that plugin. IM uses Contacts, Conversations, Conversation, and Dashboard. Contacts manages contacts through `add/remove`, Conversations manages summaries through `add/remove/update`, Conversation assembles Messages, Message, and Composer through `layout`, and Dashboard references Settings. People, Group, Contact, the old Dialog and Workspace, and component-level Contacts/Conversations/Transcript are removed.
- Same-named Player, Famicom, and RTC components should keep the same structure, events, state attributes, and lifecycle whenever compatible. Real module differences belong in each module's default `layout`.
- Dashboard only assembles Panel types, and Settings inherits its module's Panel. `show/hide` ensure only one panel is visible; component `state` is not used as panel visibility. Component constructors keep `(name, config, logger)`, where `config` retains its layout tooltip/component-name meaning; Settings data enters only through `update(data)`. Default Settings groups are built once during initialization, and every group uses title, content, and an optional footer. `update` fully refreshes controls from `{groups:[{name,title,items:[{name,type,value,options}],footer}]}` and may build the first groups supplied to a module such as IM that has no fixed product settings. Settings does not append a dedicated root style class; CSS targets `.pe-panel.settings` or `.im-panel.settings`. Famicom defaults to P1/P2 bindings, Player to Chat profile/camera/microphone, and RTC to Video/Audio with a Video preview element.
- Every `Event.CHANGE` payload contains only `name` and `value`; `value` may be a number, string, boolean, or object. Put action, key binding, stable tab name, or selection index semantics inside `name` or `value` instead of adding sibling `action`, `port`, `key`, `tab`, or `index` fields.
- Every JavaScript source ends with two newline characters so direct concatenation leaves one blank line between IIFEs.
- CSS is ordered as module root/layout, component base rules, root-attribute state rules, then responsive overrides. Within a rule, keep sizing/position, layout, box model, typography, visual, and interaction declarations in a stable order.
- Scope generic `pe-*` components through the module root (`kind`) when several SDK skins coexist.

## Famicom input

The DataChannel payload is two bytes: `[port, keys]`. One player connection may request multiple controller slots; the server returns stable, potentially non-contiguous slots in the absolute Location `ports` list. Refresh reconnect preserves that list, and releasing the player connection returns the slots. Keyboard, Gamepad, and mobile Display controls map local indexes to allocated ports before calling `keyDown(port, key)` / `keyUp(port, key)`. Controlbar direction/action Labels document keyboard bindings; they are not pointer controls.

Famicom Dashboard stats display the live FPS, decoded, dropped, NACK, PLI, freeze, and any other fields delivered by `STATSCHANGE`. Settings edit the existing P1/P2 entries in `config.keyboard`; they do not create another keyboard-state store.

## App composition

App uses the IM UI root Tab as its frame. IM contributes `contacts` and `messages`, with Conversations and Conversation sharing the messages page; App only injects `play`, `game`, and `meeting`. Tab insertion accepts only a name, page, and options. Navigation items are empty buttons whose images are set by CSS, so plugins carry no `label`. Live and VOD share one Player instance. Selecting Contacts or Messages moves the most recently active media into a top-right `popup`; selecting a media page restores that module full-size and moves Conversation into the right sidebar in `mini` presentation. Events drive section selection and DOM reparenting while module instances and domain state stay alive.
