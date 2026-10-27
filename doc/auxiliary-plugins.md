# Media auxiliary plugins

Player and RTC retain their own `UI.register` plugins and component namespaces. These plugins do not change media admission, stream ownership, core events or the download contract.

## Menu and playlist

`ContextMenu` keeps `items`, `append(item)`, the featured SDK item and the existing item `handler`. It builds an initial snapshot once, so appending does not extend an active initialization loop. Items use text nodes and native buttons. `type: 'disabled'` and missing handlers cannot activate. The `title` option labels the menu.

The Player UI binds the menu to its media root. Right click, the context-menu key and Shift+F10 open the same actions; editable inputs keep the browser menu. Arrow keys, Home and End navigate enabled items. Escape returns focus, Tab leaves, and outside pointer input closes. The menu is constrained to the media root and scrolls when necessary. Destroy removes root/document listeners and image callbacks.

`Playlist` uses a collapsible native details element, buttons and `aria-current`. Its array and DOM change together. `append(item)` adds the actual object; `remove(index)` removes it, preserves the selected object's shifted index, and clears selection when that object was removed. Removal never chooses or starts a replacement stream. An empty or cleared selection has `index() === NaN`.

`select(index)` still sends `CHANGE {name: 'playlist', value: index}` when a different enabled item is selected. The optional second argument `true` synchronizes selection without another event; `select(NaN, true)` clears the marker. Invalid indexes do nothing. Disabled items cannot select. Configurable copy is `title`, `empty`, `untitled` and `unavailable`.

At UI setup, top-level `playlist` programs supply the default plugin items. Explicit plugin metadata can override corresponding program display fields; an explicit `sources` array overrides the source. Later appended playable items must carry their own Program `sources`. UI selection reads the actual plugin item, never a stale index in the original array. Initial display-only metadata retains an explicit mapping from both original and normalized programs to their effective rows; an explicit different sources array is a different program. Autoplay and UI play/select synchronize the actual surviving row silently. Standalone Playlist still works as a selection/event widget without a media engine. With neither initial programs nor explicit Playlist configuration, the Player UI leaves this panel disabled; explicit `visibility: true` supports an empty list. Removing a currently playing item's row does not stop that independently owned media stream.

## Images, display and borrowed content

Poster accepts `file/cors/objectfit/visibility`; empty file does not request an image. Failures leave the neutral media stage and its independent play control. Both Player and RTC detach image handlers and source on destroy, and queued callbacks cannot remount a closed plugin.

Logo remains an optional customer watermark. Explicit style dimensions are retained instead of being replaced by natural image size. `alt` describes the image and `label` names a link. HTTP(S) links use `noopener noreferrer`; absent or unsupported links leave a noninteractive watermark. Failed images remain hidden. No website navigation is added to the SDK.

Display retains `layout`, `state`, `explain` and its double-click action. The central play control calls Player UI play. Waiting is a status, not an actionable button; animation is CSS-only and respects reduced motion. Error strings are written with `textContent`, leaving the original error object untouched. `labels.play/waiting/failed` and error-name labels can localize messages; an empty `failed` fallback preserves SDK error details. Runtime failures do not become successful playback states.

AD continues to borrow caller DOM through `display(element)`. Replacement, clearing and destroy detach it; the caller retains responsibility for child resources. Empty slots are hidden. No advertising timer, billing, skip policy or host content disposal is invented.

Dashboard wraps existing Panels in nonmodal sheets with a close action and Escape. `update/show/hide/clear` still reach the existing components; headers and close controls are outside the data node, so updates do not remove them. Empty information panels show a configurable explanation instead of fake statistics. Focus returns to the invoker when usable, otherwise the media root. Existing settings components and their persistence remain separate from these local presentation changes. RTC settings closure clears its borrowed preview element, releases only its owned preview and invalidates pending preview/enumeration generations. A capture that resolves after close is immediately closed and cannot attach to the hidden panel; active calls are not stopped.

## Delivery boundary

Linux and Windows RTC UI lists include Label, Display, Dashboard and Poster in dependency order. The website passes Chinese labels and disables sample Poster, Logo and Playlist for its current live/meeting entry. It implements no replacement controls or media state.

R-084 is source-reviewed only. No build, automated test, browser, device or media run establishes runtime or visual correctness. Public copies and configuration are English in the generic SDK and Chinese in the website.
