# Common interfaces and events

[中文](common-api.zh.md) · [Common SDK](common.md)

This audit lists callable shared surfaces consumed across product SDKs. Browser capability objects (`odd.OS`, `odd.Kernel`, `odd.Browser`) and exported constant enums are data surfaces rather than methods.

## Interfaces

### General utilities

| Interface | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `utils.extendz(...objects)` | ...objects: Record<string, unknown>[] | deep-merged value | Clones/merges plain data. |
| `utils.forEach(data, callback)` | data: unknown, callback: (key: string \| number, value: unknown) => void | `void` | Iterates own collection values. |
| `utils.getCookie(key)` | key: string | string or `null` | Reads a browser cookie. |
| `utils.padStart(str, targetLength, padString)` | str: string, targetLength: number, padString: string | string | Left-pads a string. |
| `utils.padEnd(str, targetLength, padString)` | str: string, targetLength: number, padString: string | string | Right-pads a string. |
| `utils.hex(num)` | num: number | hex string | Formats a number as hex. |
| `utils.date2utc(date)` | date: Date | string | Formats UTC time. |
| `utils.date2string(date)` | date: Date | string | Formats local date/time. |
| `utils.formatTime(seconds)` | seconds: number | string | Formats duration. |
| `utils.formatBytes(bytes)` | bytes: Uint8Array | string | Formats byte size. |
| `utils.typeOf(value)` | value: unknown | normalized type string | Cross-browser type detection. |
| `utils.trim(str)` | str: string | string | Trims whitespace. |
| `utils.indexOf(array, item)` | array: unknown[], item: unknown | index | Finds an array item. |
| `utils.guid()` | — | UUID-like string | Generates an identifier. |
| `utils.equal(f0, f1)` | f0: number, f1: number | boolean | Floating-point tolerance comparison. |
| `utils.createElement(name, className?)` | name: string, className?: string | element | DOM creation. |
| `utils.addClass(element, classes)` | element: HTMLElement, classes: string \| string[] | `void` | Adds classes. |
| `utils.hasClass(element, classes)` | element: HTMLElement, classes: string \| string[] | boolean | Tests classes. |
| `utils.removeClass(element, classes)` | element: HTMLElement, classes: string \| string[] | `void` | Removes classes. |
| `utils.reflow(element)` | element: HTMLElement | width | Forces layout. |
| `utils.emptyElement(element)` | element: HTMLElement | `void` | Removes all children. |
| `utils.debug(...args)` | ...args: unknown[] | `void` | Debug console wrapper. |
| `utils.log(...args)` | ...args: unknown[] | `void` | Log console wrapper. |
| `utils.warn(...args)` | ...args: unknown[] | `void` | Warning console wrapper. |
| `utils.error(...args)` | ...args: unknown[] | `void` | Error console wrapper. |
| `utils.getUint32(bytes, offset, littleEndian?)` | bytes: Uint8Array, offset: number, littleEndian?: boolean | number | Endian-aware 32-bit read. |

### Binary, parsing, and manifest utilities

| Interface | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `utils.crypt.StringToByteArray(str)` | str: string | byte array | Converts one-byte characters. |
| `utils.crypt.ByteArrayToString(bytes)` | bytes: Uint8Array | string | Converts bytes to one-byte characters. |
| `utils.crypt.ByteArrayToHex(bytes)` | bytes: Uint8Array | hex string | Hex encodes bytes. |
| `utils.crypt.HexToByteArray(hex)` | hex: unknown | byte array | Hex decodes text. |
| `utils.crypt.StringToUTF8ByteArray(str)` | str: string | byte array | UTF-8 encodes text. |
| `utils.crypt.UTF8ByteArrayToString(bytes)` | bytes: Uint8Array | string | UTF-8 decodes bytes. |
| `utils.crypt.XORByteArray(bytes1, bytes2)` | bytes1: Uint8Array, bytes2: Uint8Array | byte array | XORs arrays. |
| `BitStream.ShowBits(n)` | n: number | number | Peeks bits. |
| `BitStream.ShowBitsLong(n)` | n: number | number | Peeks a long value. |
| `BitStream.ReadBits(n)` | n: number | number | Reads bits. |
| `BitStream.ReadBitsLong(n)` | n: number | number | Reads a long value. |
| `BitStream.SkipBits(n)` | n: number | `void` | Skips bits. |
| `BitStream.Left()` | — | number | Returns remaining bits. |
| `Golomb.ReadUE()` | — | number | Reads unsigned Exp-Golomb. |
| `Golomb.ReadSE()` | — | number | Reads signed Exp-Golomb. |
| `AMF.Value.set(key, value, offset?)` | key: string, value: unknown, offset?: number | `void` | Stores decoded metadata. |
| `AMF.Value.get()` | — | decoded value | Returns accumulated value. |
| `AMF.decode(type, buffer, offset)` | type: number, buffer: number[], offset: number | decoded AMF value | Dispatches AMF0 decoding. |
| `AMF.decodeDouble(...)` | ...args: unknown[] | number | Decodes Number. |
| `AMF.decodeBoolean(...)` | ...args: unknown[] | boolean | Decodes Boolean. |
| `AMF.decodeString(...)` | ...args: unknown[] | string | Decodes String. |
| `AMF.decodeObject(...)` | ...args: unknown[] | object | Decodes Object. |
| `AMF.decodeNull(...)` | ...args: unknown[] | `null` | Decodes Null. |
| `AMF.decodeUndefined(...)` | ...args: unknown[] | `undefined` | Decodes Undefined. |
| `AMF.decodeECMAArray(...)` | ...args: unknown[] | object | Decodes ECMA Array. |
| `AMF.decodeEndOfObject(...)` | ...args: unknown[] | marker | Decodes object end. |
| `AMF.decodeStrictArray(...)` | ...args: unknown[] | array | Decodes Strict Array. |
| `AMF.decodeDate(...)` | ...args: unknown[] | Date/value | Decodes Date. |
| `AMF.decodeLongString(...)` | ...args: unknown[] | string | Decodes Long String. |
| `AMF.appendBytes(buffer, data)` | buffer: number[], data: unknown | `void` | Appends bytes. |
| `AMF.appendInt8(buffer, n)` | buffer: number[], n: number | `void` | Appends Int8. |
| `AMF.appendInt16(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | Appends Int16. |
| `AMF.appendInt32(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | Appends Int32. |
| `AMF.appendUint8(buffer, n)` | buffer: number[], n: number | `void` | Appends Uint8. |
| `AMF.appendUint16(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | Appends Uint16. |
| `AMF.appendUint32(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | Appends Uint32. |
| `AMF.encode(buffer, value)` | buffer: number[], value: unknown | `void` | Dispatches AMF0 encoding. |
| `AMF.encodeNumber(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Number. |
| `AMF.encodeBoolean(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Boolean. |
| `AMF.encodeString(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes String. |
| `AMF.encodeObject(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Object. |
| `AMF.encodeNull(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Null. |
| `AMF.encodeUndefined(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Undefined. |
| `AMF.encodeECMAArray(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes ECMA Array. |
| `AMF.encodeStrictArray(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Strict Array. |
| `AMF.encodeDate(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Date. |
| `AMF.encodeLongString(buffer, value)` | buffer: number[], value: unknown | `void` | Encodes Long String. |
| `XML2JSON.parse(xmlString)` | xmlString: string | object | Parses XML. |
| `MPD.update(mpd)` | mpd: MPDData | `void` | Updates DASH model. |
| `MPD.getSegmentInfo(time, type, isInitSegment, start, index, bandwidth)` | time: number, type: number, isInitSegment: boolean, start: number, index: number, bandwidth: number | segment info | Resolves segment. |
| `MPD.getLocation()` | — | URL/location | Returns manifest location. |
| `new utils.URL(url?)` | url?: string | URL helper | Creates and parses URL helper. |
| `URL.parse(url)` | url: string | URL helper | Re-parses URL fields. |

### Runtime utilities

| Interface | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `utils.css(selector, styles)` | selector: string \| Element \| Element[], styles: Record<string, string \| number> | helper result | CSS selector helper. **Risk:** implementation calls nonexistent `utils.foreach`. |
| `utils.css.style(elements, styles, immediate?)` | elements: Element \| Element[], styles: Record<string, string \| number>, immediate?: boolean | `void` | Applies CSS, optionally without transition. |
| `new Logger(id, config)` | id: string \| number, config: Record<string, unknown> | Logger | Creates logger. |
| `Logger.debug(...args)` | ...args: unknown[] | `void` | Debug output. |
| `Logger.log(...args)` | ...args: unknown[] | `void` | Normal output. |
| `Logger.warn(...args)` | ...args: unknown[] | `void` | Warning output. |
| `Logger.error(...args)` | ...args: unknown[] | `void` | Error output. |
| `Logger.append(level, args)` | level: string \| number, args: unknown[] | `void` | Buffers structured logs. |
| `Logger.flush()` | — | `void` | Uploads/flushes logs. |
| `new Timer(delay, repeatCount)` | delay: number, repeatCount: number | Timer | Creates timer. |
| `Timer.start()` | — | `void` | Starts timer. |
| `Timer.stop()` | — | `void` | Stops timer. |
| `Timer.reset()` | — | `void` | Stops and clears count. |
| `Timer.currentCount()` | — | number | Returns tick count. |
| `Timer.running()` | — | boolean | Returns running state. |
| `new FileSaver()` | — | FileSaver | Creates saver. |
| `FileSaver.append(typedArray)` | typedArray: ArrayBufferView | `void` | Appends bytes. |
| `FileSaver.save(filename)` | filename: string | `void` | Downloads accumulated Blob. |
| `new StreamSaver(config)` | config: Record<string, unknown> | StreamSaver | Creates stream saver. |
| `StreamSaver.register()` | — | Promise | Registers service worker. |
| `StreamSaver.record(filename)` | filename: string | StreamWriter | Opens writer. |
| `StreamSaver.unregister(outdated?)` | outdated?: boolean | Promise | Unregisters worker. |
| `StreamSaver.isSupported(version?)` | version?: string | boolean | Checks browser/service-worker support. |
| `StreamWriter.start()` | — | writer result | Starts writer. |
| `StreamWriter.write(chunk)` | chunk: Uint8Array | writer result | Writes bytes. |
| `StreamWriter.abort()` | — | writer result | Aborts writer. |
| `StreamWriter.close()` | — | writer result | Closes writer. |

<a id="event-listener-contract"></a>
### Event listener contract

| Interface | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `bind(...eventGroups)` | ...eventGroups: EventGroup[] | `void` | Creates `on<type>` properties for event types. |
| `addEventListener(type, listener, count?)` | type: string, listener: EventListener \| string, count?: number | `void` | Adds a typed listener; a string is compiled with `new Function`. |
| `removeEventListener(type, listener)` | type: string, listener: EventListener \| string | `void` | Removes one typed listener. |
| `hasEventListener(type)` | type: string | boolean | Tests typed listeners. |
| `addGlobalListener(listener, count?)` | listener: EventListener \| string, count?: number | `void` | Adds a listener for every event. |
| `removeGlobalListener(listener)` | listener: EventListener \| string | `void` | Removes a global listener. |
| `dispatchEvent(type, data?)` | type: string, data?: unknown | boolean | Delivers named then global listeners. |
| `forward(event)` | event: Event | boolean | Redispatches an event without payload translation. |
| `on<type> = callback` | callback: EventListener \| string | function/string | Single-property callback form created by `bind`. |

### IO registry and loaders

| Interface | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `IO.register(loader, index?)` | loader: LoaderConstructor, index?: number | `void` | Registers an ordered loader. Index `0` currently appends. |
| `IO.get(url, mode?)` | url: string, mode?: string | loader constructor or `null` | Selects first supported loader. |
| `odd.io(url, mode?)` | url: string, mode?: string | loader constructor or `null` | Public alias of `IO.get`. |
| loader `load(url, start?, end?)` | url: string, start?: number, end?: number | loader-specific result | Starts Fetch/MozStream/MSStream/WebSocket/XHR loading. |
| loader `abort()` | — | `void` | Aborts transport. |
| loader `state()` | — | `IO.ReadyState` | Returns transport state. |
| loader `isSupported(url, mode)` | url: string, mode: string | boolean | Constructor selection predicate. |

## Events

Every event uses the [listener contract](#event-listener-contract). The Properties column uses TypeScript syntax for fields inside `event.data`.

<a id="event-constants"></a>
### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| BIND | — | Runtime interfaces were attached. |
| READY | kind?: string | The runtime or active module is ready. |
| PLAY | — | Playback started or resumed. |
| WAITING | — | Playback is waiting for data. |
| DURATIONCHANGE | duration: number | Media duration changed. |
| LOADEDMETADATA | metadata: unknown | Metadata was loaded. |
| LOADEDDATA | — | Initial media data was loaded. |
| CANPLAY | — | Playback can begin. |
| PLAYING | — | Playback is progressing. |
| CANPLAYTHROUGH | — | Uninterrupted playback is estimated. |
| PAUSE | timestamp?: number | Playback paused. |
| SEEKING | timestamp?: number | A seek started. |
| SEEKED | timestamp?: number | A seek completed. |
| SWITCHING | index: number | A definition switch started. |
| SWITCHED | index: number | A definition switch completed when implemented. |
| RATECHANGE | rate: number | Playback rate changed. |
| TIMEUPDATE | start?: number, time: number, buffered: number, duration?: number | Playback position or buffered range changed. |
| VOLUMECHANGE | muted: boolean, volume: number | Mute or output volume changed. |
| ENDED | — | Media playback ended. |
| ERROR | name: string, message: string | An operation failed. |
| RELEASE | reason?: string | A logical resource was released. |
| CLOSE | reason?: string | A runtime or transport closed. |

### IOEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| LOADSTART | — | Loading started. |
| OPEN | — | The transport opened. |
| PROGRESS | buffer?: ArrayBuffer, loaded: number, total: number | Incremental data arrived. |
| SUSPEND | — | Loading was suspended. |
| STALLED | — | Loading stalled. |
| ABORT | — | Loading was aborted. |
| TIMEOUT | — | Loading timed out. |
| LOAD | — | The resource loaded. |
| LOADEND | — | The loading lifecycle ended. |

### MediaEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| PACKET | packet: Packet | A container packet was parsed. |
| INFOCHANGE | info: MediaInfo | Media information changed. |
| STATSUPDATE | stats: MediaStats | Media statistics changed. |
| AAC_SPECIFIC_CONFIG | packet: Packet | AAC decoder configuration was parsed. |
| AAC_SAMPLE | packet: Packet | An AAC sample was parsed. |
| AVC_CONFIG_RECORD | packet: Packet | AVC decoder configuration was parsed. |
| AVC_SAMPLE | packet: Packet | An AVC sample was parsed. |
| SEI | packet: Packet, nalu: NALUnit | An AVC SEI unit was detected. |
| END_OF_STREAM | packet: Packet | The parser reached the end of a stream. |
| SCREENSHOT | image: string | A screenshot data URL was produced. |

### MediaStreamTrackEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| ADDTRACK | track: MediaStreamTrack | A media track was added. |
| REMOVETRACK | track: MediaStreamTrack | A media track was removed. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | A connection or stream status notification arrived. |

### SaverEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| RIGISTER | — | A saver registered; the exported constant name preserves the current misspelling. |
| UNRIGISTER | — | A saver unregistered; the exported constant name preserves the current misspelling. |
| WRITERSTART | writer: StreamWriter | A writer opened. |
| WRITEREND | writer: StreamWriter | A writer ended. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| SHOOTING | text: string, data?: unknown | A comment was submitted. |
| FULLPAGE | status: boolean | Full-page mode changed. |
| FULLSCREEN | status: boolean | Browser fullscreen state changed. |
| RESIZE | width: number, height: number | A UI layout was resized. |

### GlobalEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | A named value changed. |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | A named target changed visibility. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | A named target was pressed. |
| MOUSE_UP | name: string | A named target was released. |
| CLICK | name: string, value?: unknown | A named target was clicked. |
| DOUBLE_CLICK | name: string | A named target was double-clicked. |
| MOUSE_MOVE | name: string, value?: unknown | The pointer moved over a named target. |

### TouchEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | A touch interaction started. |
| TOUCH_MOVE | name: string, touches: TouchList | A touch interaction moved. |
| TOUCH_END | name: string | A touch interaction ended. |
| TOUCH_CANCEL | name: string | A touch interaction was cancelled. |

### KeyboardEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| KEY_DOWN | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | A key was pressed. |
| KEY_UP | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | A key was released. |
| KEY_PRESS | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | A keypress was received. |

### TimerEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| TIMER | — | A timer tick occurred. |
| COMPLETE | — | A timer completed. |

`events.Code` additionally exports the complete connection, group, multicast, posting, replication, send-to, stream, recording, seek, and invoke status vocabulary. A declared code does not prove that every SDK dispatches it; product pages document reachable events.

## Audit evidence

- [`utils.js`](../../../src/utils/utils.js)
- [`src/utils`](../../../src/utils)
- [`io.js`](../../../src/io/io.js)
- [`events.js`](../../../src/events/events.js)
- [`events.eventdispatcher.js`](../../../src/events/events.eventdispatcher.js)
