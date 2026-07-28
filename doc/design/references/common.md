<a id="common-sdk"></a>
# Common SDK

[中文](common.zh.md) · [SDK map](sdk-map.md)

Bundle: `odd.common`. Source: [`src/odd.js`](../../../src/odd.js), [`src/utils`](../../../src/utils), [`src/events`](../../../src/events), [`src/io`](../../../src/io).

## Modules

<a id="utilities"></a>
### Utilities

The shared toolbox contains object/array cloning, type and formatting helpers, browser detection, DOM/CSS helpers, URL, endian and bit readers, AMF, Golomb, XML-to-JSON, MPD, logging, timers, file saving, and service-worker stream saving.

Primary exports include `odd.utils`, `odd.OS`, `odd.Kernel`, and `odd.Browser`.

<a id="events"></a>
### Events

`EventDispatcher` is the common event bus. It creates `on<type>` properties for bound event groups and supports ordinary listeners and global forwarding.

<a id="io"></a>
### IO

The ordered IO registry contains `Fetch`, `MozStream`, `MSStream`, `Websocket`, and `XHR`. HTTP loaders expose byte ranges through `load(url, start, end)`; WebSocket is live-only.

<a id="mpd"></a>
### MPD

`utils.MPD` parses and updates static/dynamic MPD data, Periods, AdaptationSets, SegmentTimeline entries, URLs, and segment information. It is a **Skeleton** for Player: no DASH playback module consumes it.

## Features

- **Browser adaptation:** runtime OS, kernel, browser, and capability detection is shared by every SDK.
- **Incremental transport:** HTTP streaming, byte ranges, WebSocket streaming, abort, progress, and ready-state reporting use one loader contract.
- **Operational primitives:** console/file/feedback logging, timers, file saving, and service-worker stream saving are reusable across products.
- One shared event vocabulary lets loaders and all SDKs forward events without translation.
- Ordered loader selection isolates browser-specific streaming behavior.
- URL, bitstream, codec-support, logging, timer, and saving concerns are reusable rather than copied into product SDKs.
- Stream saving hides ServiceWorker/TransformStream lifecycle behind `StreamSaver` and `StreamWriter`.

## Plugins

Common has no UI plugins. Its registries and primitives enable plugins in product UI bundles.

## Configuration

| Object | Keys |
| --- | --- |
| HTTP loaders | `method`, `headers`, `mode`, `credentials`, `cache`, `redirect`; XHR also has `responseType` |
| Logger | `level`, `mode`, `url`, `interval` |
| StreamSaver | `script`, `scope`, `enable` |
| Timer constructor | `delay`, `repeatCount` |

## Interfaces

| Reference | Coverage |
| --- | --- |
| [Audited interface table](common-api.md#interfaces) | Utilities, binary/manifest helpers, logging/saving, EventDispatcher, IO registry and loaders |

## Event list

| Reference | Coverage |
| --- | --- |
| [Audited event table](common-api.md#events) | Every shared event group, payload contract, spelling/reachability audit |

## Source map

- Event constants and status codes: [`events.js`](../../../src/events/events.js)
- Dispatch semantics: [`events.eventdispatcher.js`](../../../src/events/events.eventdispatcher.js)
- Loader registry: [`io.js`](../../../src/io/io.js)
- Utility exports: [`utils.js`](../../../src/utils/utils.js)
- MPD model: [`mpd.js`](../../../src/utils/mpd/mpd.js)

## Known boundaries

- `EventDispatcher` evaluates string listeners with `new Function`.
- Registry insertion cannot use position zero because it evaluates `index || length`.
- HTTP range support is transport-level only; product SDKs must implement resume state.
- The CSS helper contains a call to `utils.foreach`, while the exported helper is `forEach`.
