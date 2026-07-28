<a id="common-sdk"></a>
# Common SDK

[English](common.md) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [模块](#模块)
  - [工具](#utilities)
  - [事件](#events)
  - [IO](#io)
  - [MPD](#mpd)
- [功能特征](#功能特征)
- [插件](#插件)
- [配置](#配置)
- [接口](#接口)
  - [通用工具](#通用工具)
  - [二进制、解析与清单](#二进制解析与清单)
  - [运行时工具](#运行时工具)
  - [事件监听契约](#event-listener-contract)
  - [IO 注册表与加载器](#io-注册表与加载器)
- [事件列表](#事件列表)
  - [Event](#event-constants)
  - [IOEvent](#ioevent)
  - [MediaEvent](#mediaevent)
  - [MediaStreamTrackEvent](#mediastreamtrackevent)
  - [NetStatusEvent](#netstatusevent)
  - [SaverEvent](#saverevent)
  - [UIEvent](#uievent)
  - [GlobalEvent](#globalevent)
  - [MouseEvent](#mouseevent)
  - [TouchEvent](#touchevent)
  - [KeyboardEvent](#keyboardevent)
  - [TimerEvent](#timerevent)
- [审核依据](#审核依据)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.common`。源码：[`src/odd.js`](../../../src/odd.js)、[`src/utils`](../../../src/utils)、[`src/events`](../../../src/events)、[`src/io`](../../../src/io)。

## 模块

<a id="utilities"></a>
### 工具

共享工具箱包含对象／数组复制、类型与格式化、浏览器检测、DOM/CSS、URL、端序与位读取、AMF、Golomb、XML-to-JSON、MPD、日志、Timer、文件保存和 ServiceWorker 流式保存。

主要导出为 `odd.utils`、`odd.OS`、`odd.Kernel` 和 `odd.Browser`。

<a id="events"></a>
### 事件

`EventDispatcher` 是公共事件总线。它会为绑定的事件组创建 `on<type>` 属性，并支持普通监听和全局转发。

<a id="io"></a>
### IO

有序 IO 注册表包含 `Fetch`、`MozStream`、`MSStream`、`Websocket`、`XHR`。HTTP 加载器通过 `load(url, start, end)` 暴露字节范围；WebSocket 只用于直播。

<a id="mpd"></a>
### MPD

`utils.MPD` 可解析和更新静态／动态 MPD、Period、AdaptationSet、SegmentTimeline、URL 和分片信息。它对 Player 来说仍是**骨架**：没有 DASH 播放模块消费它。

## 功能特征

- **浏览器适配：**统一检测操作系统、内核、浏览器和运行能力，供全部 SDK 复用。
- **增量传输：**HTTP 流、字节范围、WebSocket 流、取消、进度和状态统一使用 Loader 契约。
- **运维基础：**控制台/文件/反馈日志、Timer、文件保存和 ServiceWorker 流式保存可跨产品复用。
- 统一事件词汇让加载器和所有 SDK 无需转换即可转发事件。
- 有序加载器选择隔离浏览器差异。
- URL、位流、浏览器能力、日志、Timer 和保存逻辑没有复制到产品 SDK。
- `StreamSaver` 与 `StreamWriter` 隐藏 ServiceWorker/TransformStream 生命周期。

## 插件

Common 没有 UI 插件；它提供产品 UI 插件所需的注册表和基础能力。

## 配置

| 对象 | 配置项 |
| --- | --- |
| HTTP 加载器 | `method`、`headers`、`mode`、`credentials`、`cache`、`redirect`；XHR 还有 `responseType` |
| Logger | `level`、`mode`、`url`、`interval` |
| StreamSaver | `script`、`scope`、`enable` |
| Timer 构造参数 | `delay`、`repeatCount` |

## 接口

本页审核各产品 SDK 共用的可调用接口。`odd.OS`、`odd.Kernel`、`odd.Browser` 与各类枚举属于数据接口。

### 通用工具

| 接口 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- |
| `utils.extendz(...objects)` | ...objects: Record<string, unknown>[] | 深合并值 | 克隆并合并普通数据。 |
| `utils.forEach(data, callback)` | data: unknown, callback: (key: string \| number, value: unknown) => void | `void` | 遍历数组或对象。 |
| `utils.getCookie(key)` | key: string | 字符串或 `null` | 读取 Cookie。 |
| `utils.padStart(str, targetLength, padString)` | str: string, targetLength: number, padString: string | 字符串 | 左侧填充。 |
| `utils.padEnd(str, targetLength, padString)` | str: string, targetLength: number, padString: string | 字符串 | 右侧填充。 |
| `utils.hex(num)` | num: number | 十六进制字符串 | 格式化十六进制。 |
| `utils.date2utc(date)` | date: Date | 字符串 | UTC 格式化。 |
| `utils.date2string(date)` | date: Date | 字符串 | 本地日期格式化。 |
| `utils.formatTime(seconds)` | seconds: number | 字符串 | 格式化时长。 |
| `utils.formatBytes(bytes)` | bytes: Uint8Array | 字符串 | 格式化大小。 |
| `utils.typeOf(value)` | value: unknown | 类型字符串 | 统一类型判断。 |
| `utils.trim(str)` | str: string | 字符串 | 去空白。 |
| `utils.indexOf(array, item)` | array: unknown[], item: unknown | 索引 | 查找数组项。 |
| `utils.guid()` | — | 类 UUID 字符串 | 生成标识。 |
| `utils.equal(f0, f1)` | f0: number, f1: number | 布尔值 | 浮点容差比较。 |
| `utils.createElement(name, className?)` | name: string, className?: string | DOM 元素 | 创建元素。 |
| `utils.addClass(element, classes)` | element: HTMLElement, classes: string \| string[] | `void` | 增加类。 |
| `utils.hasClass(element, classes)` | element: HTMLElement, classes: string \| string[] | 布尔值 | 判断类。 |
| `utils.removeClass(element, classes)` | element: HTMLElement, classes: string \| string[] | `void` | 移除类。 |
| `utils.reflow(element)` | element: HTMLElement | 宽度 | 强制重排。 |
| `utils.emptyElement(element)` | element: HTMLElement | `void` | 清空子节点。 |
| `utils.debug(...args)` | ...args: unknown[] | `void` | 调试输出。 |
| `utils.log(...args)` | ...args: unknown[] | `void` | 普通输出。 |
| `utils.warn(...args)` | ...args: unknown[] | `void` | 警告输出。 |
| `utils.error(...args)` | ...args: unknown[] | `void` | 错误输出。 |
| `utils.getUint32(bytes, offset, littleEndian?)` | bytes: Uint8Array, offset: number, littleEndian?: boolean | 数字 | 读取 32 位整数。 |

### 二进制、解析与清单

| 接口 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- |
| `crypt.StringToByteArray(str)` | str: string | 字节数组 | 单字节编码。 |
| `crypt.ByteArrayToString(bytes)` | bytes: Uint8Array | 字符串 | 单字节解码。 |
| `crypt.ByteArrayToHex(bytes)` | bytes: Uint8Array | 十六进制 | 十六进制编码。 |
| `crypt.HexToByteArray(hex)` | hex: unknown | 字节数组 | 十六进制解码。 |
| `crypt.StringToUTF8ByteArray(str)` | str: string | 字节数组 | UTF-8 编码。 |
| `crypt.UTF8ByteArrayToString(bytes)` | bytes: Uint8Array | 字符串 | UTF-8 解码。 |
| `crypt.XORByteArray(bytes1, bytes2)` | bytes1: Uint8Array, bytes2: Uint8Array | 字节数组 | XOR。 |
| `BitStream.ShowBits(n)` | n: number | 数字 | 查看位。 |
| `BitStream.ShowBitsLong(n)` | n: number | 数字 | 查看长值。 |
| `BitStream.ReadBits(n)` | n: number | 数字 | 读取位。 |
| `BitStream.ReadBitsLong(n)` | n: number | 数字 | 读取长值。 |
| `BitStream.SkipBits(n)` | n: number | `void` | 跳过位。 |
| `BitStream.Left()` | — | 数字 | 剩余位数。 |
| `Golomb.ReadUE()` | — | 数字 | 无符号 Exp-Golomb。 |
| `Golomb.ReadSE()` | — | 数字 | 有符号 Exp-Golomb。 |
| `AMF.Value.set(key, value, offset?)` | key: string, value: unknown, offset?: number | `void` | 保存解码字段。 |
| `AMF.Value.get()` | — | 值 | 返回累计值。 |
| `AMF.decode(type, buffer, offset)` | type: number, buffer: number[], offset: number | 值 | 分派 AMF0 解码。 |
| `AMF.decodeDouble(...)` | ...args: unknown[] | 数字 | 解码 Number。 |
| `AMF.decodeBoolean(...)` | ...args: unknown[] | 布尔值 | 解码 Boolean。 |
| `AMF.decodeString(...)` | ...args: unknown[] | 字符串 | 解码 String。 |
| `AMF.decodeObject(...)` | ...args: unknown[] | 对象 | 解码 Object。 |
| `AMF.decodeNull(...)` | ...args: unknown[] | null | 解码 Null。 |
| `AMF.decodeUndefined(...)` | ...args: unknown[] | undefined | 解码 Undefined。 |
| `AMF.decodeECMAArray(...)` | ...args: unknown[] | 对象 | 解码 ECMA Array。 |
| `AMF.decodeEndOfObject(...)` | ...args: unknown[] | 标记 | 解码对象结束。 |
| `AMF.decodeStrictArray(...)` | ...args: unknown[] | 数组 | 解码 Strict Array。 |
| `AMF.decodeDate(...)` | ...args: unknown[] | 日期值 | 解码 Date。 |
| `AMF.decodeLongString(...)` | ...args: unknown[] | 字符串 | 解码 Long String。 |
| `AMF.appendBytes(buffer, data)` | buffer: number[], data: unknown | `void` | 追加字节。 |
| `AMF.appendInt8(buffer, n)` | buffer: number[], n: number | `void` | 追加 Int8。 |
| `AMF.appendInt16(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | 追加 Int16。 |
| `AMF.appendInt32(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | 追加 Int32。 |
| `AMF.appendUint8(buffer, n)` | buffer: number[], n: number | `void` | 追加 Uint8。 |
| `AMF.appendUint16(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | 追加 Uint16。 |
| `AMF.appendUint32(buffer, n, littleEndian?)` | buffer: number[], n: number, littleEndian?: boolean | `void` | 追加 Uint32。 |
| `AMF.encode(buffer, value)` | buffer: number[], value: unknown | `void` | 分派 AMF0 编码。 |
| `AMF.encodeNumber(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Number。 |
| `AMF.encodeBoolean(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Boolean。 |
| `AMF.encodeString(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 String。 |
| `AMF.encodeObject(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Object。 |
| `AMF.encodeNull(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Null。 |
| `AMF.encodeUndefined(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Undefined。 |
| `AMF.encodeECMAArray(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 ECMA Array。 |
| `AMF.encodeStrictArray(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Strict Array。 |
| `AMF.encodeDate(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Date。 |
| `AMF.encodeLongString(buffer, value)` | buffer: number[], value: unknown | `void` | 编码 Long String。 |
| `XML2JSON.parse(xmlString)` | xmlString: string | 对象 | 解析 XML。 |
| `MPD.update(mpd)` | mpd: MPDData | `void` | 更新 DASH 模型。 |
| `MPD.getSegmentInfo(time, type, isInitSegment, start, index, bandwidth)` | time: number, type: number, isInitSegment: boolean, start: number, index: number, bandwidth: number | 分片信息 | 解析分片。 |
| `MPD.getLocation()` | — | 地址 | 返回清单地址。 |
| `new utils.URL(url?)` | url?: string | URL 辅助对象 | 创建并解析 URL。 |
| `URL.parse(url)` | url: string | URL 辅助对象 | 重新解析字段。 |

### 运行时工具

| 接口 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- |
| `utils.css(selector, styles)` | selector: string \| Element \| Element[], styles: Record<string, string \| number> | 辅助结果 | CSS 辅助。**风险：**实现调用不存在的 `utils.foreach`。 |
| `utils.css.style(elements, styles, immediate?)` | elements: Element \| Element[], styles: Record<string, string \| number>, immediate?: boolean | `void` | 应用样式。 |
| `new Logger(id, config)` | id: string \| number, config: Record<string, unknown> | Logger | 创建日志器。 |
| `Logger.debug(...args)` | ...args: unknown[] | `void` | 调试输出。 |
| `Logger.log(...args)` | ...args: unknown[] | `void` | 普通输出。 |
| `Logger.warn(...args)` | ...args: unknown[] | `void` | 警告输出。 |
| `Logger.error(...args)` | ...args: unknown[] | `void` | 错误输出。 |
| `Logger.append(level, args)` | level: string \| number, args: unknown[] | `void` | 缓存日志。 |
| `Logger.flush()` | — | `void` | 提交日志。 |
| `new Timer(delay, repeatCount)` | delay: number, repeatCount: number | Timer | 创建定时器。 |
| `Timer.start()` | — | `void` | 启动。 |
| `Timer.stop()` | — | `void` | 停止。 |
| `Timer.reset()` | — | `void` | 停止并清零。 |
| `Timer.currentCount()` | — | 数字 | 当前计数。 |
| `Timer.running()` | — | 布尔值 | 运行状态。 |
| `new FileSaver()` | — | FileSaver | 创建文件保存器。 |
| `FileSaver.append(typedArray)` | typedArray: ArrayBufferView | `void` | 追加数据。 |
| `FileSaver.save(filename)` | filename: string | `void` | 下载 Blob。 |
| `new StreamSaver(config)` | config: Record<string, unknown> | StreamSaver | 创建流保存器。 |
| `StreamSaver.register()` | — | Promise | 注册 ServiceWorker。 |
| `StreamSaver.record(filename)` | filename: string | Writer | 打开 Writer。 |
| `StreamSaver.unregister(outdated?)` | outdated?: boolean | Promise | 注销 Worker。 |
| `StreamSaver.isSupported(version?)` | version?: string | 布尔值 | 检查支持。 |
| `StreamWriter.start()` | — | 写入结果 | 启动 Writer。 |
| `StreamWriter.write(chunk)` | chunk: Uint8Array | 写入结果 | 写入。 |
| `StreamWriter.abort()` | — | 写入结果 | 中止。 |
| `StreamWriter.close()` | — | 写入结果 | 关闭。 |

<a id="event-listener-contract"></a>
### 事件监听契约

| 接口 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- |
| `bind(...eventGroups)` | ...eventGroups: EventGroup[] | `void` | 为各类型创建 `on<type>` 属性。 |
| `addEventListener(type, listener, count?)` | type: string, listener: EventListener \| string, count?: number | `void` | 添加监听；字符串会由 `new Function` 编译。 |
| `removeEventListener(type, listener)` | type: string, listener: EventListener \| string | `void` | 移除监听。 |
| `hasEventListener(type)` | type: string | 布尔值 | 判断是否存在监听。 |
| `addGlobalListener(listener, count?)` | listener: EventListener \| string, count?: number | `void` | 监听全部事件。 |
| `removeGlobalListener(listener)` | listener: EventListener \| string | `void` | 移除全局监听。 |
| `dispatchEvent(type, data?)` | type: string, data?: unknown | 布尔值 | 依次派发命名与全局监听器。 |
| `forward(event)` | event: Event | 布尔值 | 不翻译负载地转发事件。 |
| `on<type> = callback` | callback: EventListener \| string | 函数／字符串 | `bind` 创建的回调形式。 |

### IO 注册表与加载器

| 接口 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- |
| `IO.register(loader, index?)` | loader: LoaderConstructor, index?: number | `void` | 有序注册；当前传 `0` 仍会追加。 |
| `IO.get(url, mode?)` | url: string, mode?: string | 构造函数或 `null` | 选择首个支持加载器。 |
| `odd.io(url, mode?)` | url: string, mode?: string | 构造函数或 `null` | `IO.get` 的公开别名。 |
| `load(url, start?, end?)` | url: string, start?: number, end?: number | 依加载器而定 | 启动 Fetch/MozStream/MSStream/WebSocket/XHR。 |
| `abort()` | — | `void` | 中止传输。 |
| `state()` | — | `IO.ReadyState` | 返回状态。 |
| `isSupported(url, mode)` | url: string, mode: string | 布尔值 | 加载器选择谓词。 |

## 事件列表

所有事件使用[事件监听契约](#事件监听契约)。属性列使用 TypeScript 语法描述 `event.data` 中的字段。

<a id="event-constants"></a>
### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | 运行时接口已挂载。 |
| READY | kind?: string | 运行时或当前模块已就绪。 |
| PLAY | — | 播放开始或恢复。 |
| WAITING | — | 播放正在等待数据。 |
| DURATIONCHANGE | duration: number | 媒体时长发生变化。 |
| LOADEDMETADATA | metadata: unknown | 元信息已加载。 |
| LOADEDDATA | — | 初始媒体数据已加载。 |
| CANPLAY | — | 可以开始播放。 |
| PLAYING | — | 正在播放。 |
| CANPLAYTHROUGH | — | 预计可以连续播放。 |
| PAUSE | timestamp?: number | 播放已暂停。 |
| SEEKING | timestamp?: number | 跳转开始。 |
| SEEKED | timestamp?: number | 跳转完成。 |
| SWITCHING | index: number | 清晰度切换开始。 |
| SWITCHED | index: number | 在实现支持时表示清晰度切换完成。 |
| RATECHANGE | rate: number | 播放速率发生变化。 |
| TIMEUPDATE | start?: number, time: number, buffered: number, duration?: number | 播放位置或缓冲区发生变化。 |
| VOLUMECHANGE | muted: boolean, volume: number | 静音或输出音量发生变化。 |
| ENDED | — | 媒体播放结束。 |
| ERROR | name: string, message: string | 操作失败。 |
| RELEASE | reason?: string | 逻辑资源已释放。 |
| CLOSE | reason?: string | 运行时或传输已关闭。 |

### IOEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| LOADSTART | — | 加载开始。 |
| OPEN | — | 传输已打开。 |
| PROGRESS | buffer?: ArrayBuffer, loaded: number, total: number | 收到增量数据。 |
| SUSPEND | — | 加载被挂起。 |
| STALLED | — | 加载停滞。 |
| ABORT | — | 加载被中止。 |
| TIMEOUT | — | 加载超时。 |
| LOAD | — | 资源加载完成。 |
| LOADEND | — | 加载生命周期结束。 |

### MediaEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| PACKET | packet: Packet | 解析出封装数据包。 |
| INFOCHANGE | info: MediaInfo | 媒体信息发生变化。 |
| STATSUPDATE | stats: MediaStats | 媒体统计发生变化。 |
| AAC_SPECIFIC_CONFIG | packet: Packet | 解析出 AAC 解码配置。 |
| AAC_SAMPLE | packet: Packet | 解析出 AAC 采样。 |
| AVC_CONFIG_RECORD | packet: Packet | 解析出 AVC 解码配置。 |
| AVC_SAMPLE | packet: Packet | 解析出 AVC 采样。 |
| SEI | packet: Packet, nalu: NALUnit | 检测到 AVC SEI 单元。 |
| END_OF_STREAM | packet: Packet | 解析器到达流末尾。 |
| SCREENSHOT | image: string | 生成截图 Data URL。 |

### MediaStreamTrackEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| ADDTRACK | track: MediaStreamTrack | 添加媒体轨道。 |
| REMOVETRACK | track: MediaStreamTrack | 移除媒体轨道。 |

### NetStatusEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | 收到连接或流状态通知。 |

### SaverEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| RIGISTER | — | Saver 已注册；导出的常量名保留当前拼写错误。 |
| UNRIGISTER | — | Saver 已注销；导出的常量名保留当前拼写错误。 |
| WRITERSTART | writer: StreamWriter | Writer 已打开。 |
| WRITEREND | writer: StreamWriter | Writer 已结束。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| SHOOTING | text: string, data?: unknown | 已提交一条弹幕。 |
| FULLPAGE | status: boolean | 铺满页面状态发生变化。 |
| FULLSCREEN | status: boolean | 浏览器全屏状态发生变化。 |
| RESIZE | width: number, height: number | UI 布局尺寸发生变化。 |

### GlobalEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | 指定值发生变化。 |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | 指定目标的可见性发生变化。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | 按下指定目标。 |
| MOUSE_UP | name: string | 松开指定目标。 |
| CLICK | name: string, value?: unknown | 点击指定目标。 |
| DOUBLE_CLICK | name: string | 双击指定目标。 |
| MOUSE_MOVE | name: string, value?: unknown | 指针在指定目标上移动。 |

### TouchEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | 触控开始。 |
| TOUCH_MOVE | name: string, touches: TouchList | 触控移动。 |
| TOUCH_END | name: string | 触控结束。 |
| TOUCH_CANCEL | name: string | 触控取消。 |

### KeyboardEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| KEY_DOWN | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | 按键被按下。 |
| KEY_UP | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | 按键被松开。 |
| KEY_PRESS | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | 收到按键输入。 |

### TimerEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| TIMER | — | 定时器触发一次。 |
| COMPLETE | — | 定时器执行完成。 |

`events.Code` 还导出连接、群组、组播、投递、复制、点发、流、录制、跳转与调用等完整状态词汇。常量存在不代表每个 SDK 都会派发；产品页只记录可达事件。

## 审核依据

- [`utils.js`](../../../src/utils/utils.js)
- [`src/utils`](../../../src/utils)
- [`io.js`](../../../src/io/io.js)
- [`events.js`](../../../src/events/events.js)
- [`events.eventdispatcher.js`](../../../src/events/events.eventdispatcher.js)

## 源码地图

- 事件常量和状态码：[`events.js`](../../../src/events/events.js)
- 分发语义：[`events.eventdispatcher.js`](../../../src/events/events.eventdispatcher.js)
- 加载器注册表：[`io.js`](../../../src/io/io.js)
- 工具导出：[`utils.js`](../../../src/utils/utils.js)
- MPD 模型：[`mpd.js`](../../../src/utils/mpd/mpd.js)

## 已知边界

- `EventDispatcher` 会用 `new Function` 执行字符串监听器。
- 注册位置使用 `index || length`，因此不能插入到索引零。
- HTTP Range 只是传输能力；断点状态需要产品 SDK 自己实现。
- CSS 工具里出现 `utils.foreach`，但实际导出名是 `forEach`。
