<a id="player-sdk"></a>
# Player SDK

[English](player.md) · [产品目标](architecture.zh.md#目标树) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [内核](#core)
- [播放模块](#playback-modules)
- [功能特征](#功能特征)
- [插件](#plugins)
- [配置](#配置)
  - [内核](#内核)
  - [UI](#ui)
- [接口](#接口)
  - [Core 静态接口](#core-静态接口)
  - [Core 实例接口](#core-实例接口)
  - [UI 静态接口](#ui-静态接口)
  - [UI 实例接口](#ui-实例接口)
- [事件](#事件)
  - [Event](#event)
  - [IOEvent](#ioevent)
  - [MediaEvent](#mediaevent)
  - [SaverEvent](#saverevent)
  - [UIEvent](#uievent)
  - [GlobalEvent](#globalevent)
  - [MouseEvent](#mouseevent)
- [审核依据](#审核依据)
- [产品能力说明](#产品能力说明)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.player`，可选 `odd.player.ui`。在线演示：[直播](https://oddengine.com/zh/solution/live.html)、[点播](https://oddengine.com/zh/solution/vod.html)。

<a id="core"></a>
## 内核

`Player` 是公共门面。`Model` 管理源、当前清晰度、时长、状态和属性；`View` 管理当前播放模块和媒体元素；`Controller` 管理播放／重载、重试、状态、媒体信息和统计。这个小型 MVC 将协议模块与编排逻辑分开。

<a id="playback-modules"></a>
## 播放模块

| 模块 | 状态 | 主要路径 |
| --- | --- | --- |
| <a id="cap-native-media"></a>SRC | **已验证** | 浏览器原生 MPEG-4、OGG、WebM、MP3/AAC，以及按平台选择的 HLS |
| <a id="cap-flv"></a>FLV | **已验证** | HTTP/WS 字节 → FLV 解析 → AAC/AVC → FMP4 重封装 → MediaSource |
| <a id="cap-cmaf"></a>FMP4 | **字节流已验证／CMAF 产品能力部分实现** | HTTP/WS fragmented MP4 box → MediaSource |
| RTC | **已验证** | 通过 `odd.rtc` 做 WHEP 播放，再适配为 Player 事件 |
| <a id="cap-hls"></a>HLS | **部分实现** | 部分移动端／macOS Safari 通过 SRC 原生播放 |
| <a id="cap-hls2"></a>HLS-2nd | **待实现** | 未找到模块 |
| <a id="cap-dash"></a>DASH | **骨架** | Common 有 MPD 模型，但 Player 没有 DASH 模块 |

模块选择使用有序注册表。`Module.get(file, option)` 先检查指定模块，再按注册顺序调用 `isSupported`。

## 功能特征

- **多实例与动态生命周期：**Player 和 UI 各自维护实例表，通过 `get(id)` 稳定配对、`create()` 自动分配 id，并显式 `destroy()`。
- **7×24 连续直播设计：**FLV/FMP4 按 `maxPlaybackLength` 周期清理旧 SourceBuffer 区间，限制长时间运行时保留的媒体窗口。源码机制已验证，但仓库没有长时间压力测试来证明时长 SLA。
- **直播无累积延迟：**启用 `lowlatency` 后，缓冲超过 `maxBufferLength` 时以 1.2 倍追赶，接近 `bufferLength` 时恢复 1 倍，延迟超过 5 秒时执行硬纠偏。
- **轨道容错：**FLV 元信息/标志决定音频、视频 SourceBuffer 的创建，支持纯音频、纯视频和音视频流。
- **截图、录制与可观测性：**通过统一门面提供 Canvas 截图、渐进式 FMP4 保存、媒体信息、统计、SEI 和 Writer 事件。
- 内核/UI 分离，可无界面使用播放器。
- MVC 将源策略、活动模块和重试／状态编排分开。
- 模块、Codec、Format、Loader、UI 插件统一使用有序注册表。
- 各播放模块提供相同的播放、暂停、跳转、停止、静音、音量、媒体元素契约。
- UI 布局由字符串数据描述，可不改插件类就调整、删除或排序组件。
- 内核事件原样向上流动；UI 只处理自己关心的事件，其余继续转发。

<a id="plugins"></a>
## 插件

下表严格按定义的产品分层顺序排列：越靠下，所在 UI 层级越高。

| 目标／当前映射 | 状态 | 主要职责／配置 |
| --- | --- | --- |
| <a id="cap-content"></a>`Content` 抽象；当前映射为 `Chat` | **抽象待实现／映射部分具备** | Live/WatchParty/RTC/IM 目标尚未注册；`Chat` 提供依赖 RTC 的本地／远端视频列表及 `client`、`rtc`、`service`、`visibility` |
| <a id="cap-subtitle-plugin"></a>`Subtitle` | **待实现** | 没有解析器、渲染器或插件 |
| <a id="cap-poster"></a>`Poster` | **已验证** | `file`、`cors`、`objectfit`、`visibility` |
| <a id="cap-comment"></a>`Comment`；当前实现为 `Danmu` | **实现已验证／名称不同** | 弹幕运动；`speed`、`lineHeight`、`enable`、`visibility` |
| <a id="cap-dashboard"></a>`Dashboard`；当前实现为 `Display` | **目标映射部分具备** | 状态／错误、元信息和统计面板；`layout`、`ondoubleclick`、`visibility` |
| `AD` | **基础能力已验证** | 插入／移除调用方 DOM；`visibility` |
| `Share` | **基础能力已验证** | 插入调用方 DOM；`visibility` |
| <a id="cap-logo"></a>`Logo` | **已验证** | `file`、`link`、`cors`、`target`、`style`、`visibility` |
| <a id="cap-controlbar"></a>`Controlbar` | **核心已验证／目标控件部分具备** | 布局驱动控件；`layout`、`autohide`、`visibility` |
| <a id="cap-contextmenu"></a>`ContextMenu` | **已验证** | 可配置菜单项及媒体信息／统计；`items`、`visibility` |
| <a id="cap-sidebar"></a>`Sidebar` | **待实现** | Userlist/Playlist/Tools/Settings/Layout 目标尚未注册 |
| <a id="cap-dialog"></a>`Dialog` | **待实现** | Notify/Alert/Confirm 目标尚未注册 |

## 配置

### 内核

| 分组 | 配置项 |
| --- | --- |
| 播放 | `airplay`、`autoplay`、`file`、`loop`、`mode`、`module`、`muted`、`objectfit`、`playsinline`、`preload`、`volume` |
| 缓冲／重试 | `bufferLength`、`maxBufferLength`、`maxPlaybackLength`、`lowlatency`、`maxRetries`、`retrying` |
| 源策略 | `sources[]` 中的 `file`、`module`、`loader`、`default`、`label`；顶层 `loader` |
| 集成 | `im`、`rtc`、`service` |
| 已声明但未端到端接通 | `dynamic`、`smoothing` |

`loader` 包含 `name`、`mode`、`credentials`；`service` 包含 `script`、`scope`、`enable`。

### UI

`aspectratio`（已废弃）、`client`、`skin`、`plugins[]`，并与全部内核配置合并。

<a id="cap-skins"></a>UI 在 setup 时添加 `pe-ui-<skin>`。目前只看到 classic 皮肤和初始化时选择，运行时一键切换为**部分实现**。

## 接口

<a id="cap-instances"></a>

core 与 UI 均提供同 id 的 `get/create` 注册表：多实例已**验证**。

本页依据 `src/player` 审核公开的 Core 与 UI 门面，包括仅在 `setup()` 后挂载的方法；内部扩展接口不在本页列出。

这里只列对外的 Core 与 UI 门面。播放模块、编解码器、封装格式、插件、组件及其注册接口属于实现细节，不作为 Player SDK 实例 API。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 Core 实例，不存在时创建。由 `Player.get` 实现，并通过 `odd.player` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 Core 实例。 |

### Core 实例接口

`play` 至 `state` 在 `setup()` 完成 Core 绑定后挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config?: PlayerConfig | 创建并绑定播放 Model、View 与 Controller。 |
| `play` | file?: string, option?: PlaybackOptions | 选择媒体源与模块，或恢复暂停的播放。 |
| `pause` | — | 暂停当前播放模块。 |
| `seek` | offset: number | 跳转当前播放模块。 |
| `stop` | — | 停止播放并清理当前媒体源状态。 |
| `reload` | — | 重新加载当前媒体源。 |
| `muted` | status?: boolean | 读取或设置静音状态。 |
| `volume` | value?: number | 读取或设置输出音量。 |
| `definition` | index?: number | 读取或切换清晰度。 |
| `capture` | width?: number, height?: number, mime?: string | 截取当前画面并触发 `screenshot`。 |
| `record` | filename: string | 在当前播放模块支持时开始录制。 |
| `element` | — | 返回当前渲染元素。 |
| `getProperty` | key: string | 返回 `key` 对应的元信息/Model 数据。 |
| `duration` | — | 返回媒体时长，单位为秒。 |
| `state` | — | 返回当前播放状态。 |
| `destroy` | — | 销毁播放资源并移除 Core 实例。 |

### UI 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取与同 id Core 配对的稳定 UI 实例。由 `Player.UI.get` 实现，并通过 `odd.player.ui` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 UI 实例。 |

### UI 实例接口

Core 绑定后，UI 也会转发上表中的 Core 实例接口；这里不再重复列出。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: PlayerUIConfig | 构建 UI 并初始化配对的 Core。 |
| `chat` | enable: boolean | 在插件已安装时启用或关闭聊天 UI。 |
| `danmu` | enable: boolean | 启用或关闭弹幕。 |
| `shoot` | text: string, data?: unknown | 向 Danmu 插件发送弹幕。 |
| `displayAD` | element: HTMLElement | 通过 AD 插件显示内容。 |
| `removeAD` | — | 移除 AD 插件显示的内容。 |
| `fullpage` | status?: boolean | 读取或设置铺满页面模式。 |
| `fullscreen` | status?: boolean | 读取或请求浏览器全屏。 |
| `resize` | — | 调整当前播放视图与 UI 插件尺寸。 |
| `destroy` | — | 移除 UI 资源、销毁配对的 Core 并注销 UI。 |

## 事件

<a id="cap-events"></a>

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段；监听方式见 [Common](common.zh.md#event-listener-contract) 中的 `on<type>` 与监听接口。Core 事件会转发到 UI。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | Core 或 UI 门面已完成运行时接口挂载。 |
| READY | kind: string | 当前播放模块已就绪。 |
| PLAY | — | 播放开始或恢复。 |
| WAITING | — | 播放正在等待更多媒体数据。 |
| DURATIONCHANGE | duration: number | 媒体时长发生变化。 |
| LOADEDMETADATA | metadata: unknown | 媒体元信息已加载。 |
| LOADEDDATA | — | 当前帧数据已加载。 |
| CANPLAY | — | 已有足够数据开始播放。 |
| PLAYING | — | 暂停或缓冲后正在继续播放。 |
| CANPLAYTHROUGH | — | 浏览器预计能够连续播放而无需缓冲。 |
| PAUSE | timestamp: number | 播放已暂停。 |
| SEEKING | timestamp: number | 跳转操作开始。 |
| SEEKED | timestamp: number | 跳转操作完成。 |
| SWITCHING | index: number | 手动清晰度切换开始。 |
| SWITCHED | index: number | **预留：** 已声明并转发，但当前未找到派发。 |
| RATECHANGE | rate: number | 播放速率发生变化，包括低延迟追赶。 |
| TIMEUPDATE | start: number, time: number, buffered: number, duration: number | 播放位置或缓冲区发生变化，具体字段取决于模块。 |
| VOLUMECHANGE | muted: boolean, volume: number | 静音或输出音量发生变化。 |
| ENDED | — | 媒体播放结束。 |
| ERROR | name: string, message: string | 播放、媒体选择、解析、MSE 或截图失败。 |

### IOEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| LOADSTART | — | 资源加载开始。 |
| OPEN | — | 底层传输已打开。 |
| PROGRESS | buffer: ArrayBuffer, loaded: number, total: number | 收到增量资源数据。 |
| SUSPEND | — | 资源加载被挂起。 |
| STALLED | — | 资源加载停滞。 |
| ABORT | — | 资源加载被中止。 |
| TIMEOUT | — | 资源加载超时。 |
| LOAD | — | 资源加载成功。 |
| LOADEND | — | 资源加载生命周期结束。 |

### MediaEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| INFOCHANGE | info: MediaInfo | 媒体或封装信息发生变化。 |
| STATSUPDATE | stats: MediaStats | 运行时媒体统计发生变化。 |
| SEI | packet: Packet, nalu: NALUnit | 检测到 H264 补充增强信息单元。 |
| SCREENSHOT | image: string | `capture` 生成图片 Data URL。 |

### SaverEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | 录制写入器已打开。 |
| WRITEREND | writer: StreamWriter | 录制写入器已结束。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| SHOOTING | text: string, data?: unknown | 已提交一条弹幕。 |
| FULLPAGE | status: boolean | 铺满页面状态发生变化。 |
| FULLSCREEN | status: boolean | 浏览器全屏状态发生变化。 |
| RESIZE | width: number, height: number | Player UI 尺寸发生变化。 |

### GlobalEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | 指定 UI 值发生变化。 |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | 指定面板变为 `visible` 或 `hidden`。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | 点击指定 UI 目标。 |
| DOUBLE_CLICK | name: string | 双击指定 UI 目标。 |
| MOUSE_MOVE | name: string, value?: unknown | 指针在指定 UI 目标上移动。 |

Common 定义了 `KeyboardEvent`，但当前 Player UI 未绑定。

## 审核依据

- [`player.js`](../../../src/player/player.js)
- [`player.view.js`](../../../src/player/player.view.js)
- [`ui.js`](../../../src/player/ui/ui.js)
- [`src/player`](../../../src/player)

## 产品能力说明

- <a id="cap-subtitles"></a>TTML/WebVTT/SRT 字幕：**待实现**。
- <a id="cap-buffer"></a>智能缓冲：FLV/FMP4 **已验证**。接近 `bufferLength` 时开始播放，超过 `maxBufferLength` 时加速，超过 `maxPlaybackLength` 时清理。
- <a id="cap-abr"></a>BOLA-E ABR：**待实现**。手动清晰度选择不等于 ABR。
- <a id="cap-resume"></a>断点下载：只有**部分传输基础**；模块不保存偏移／实体标识，也不恢复解析器状态。
- <a id="cap-capture"></a>JPG/PNG 截图：通过 Canvas `toDataURL(mime)` **已验证**。
- <a id="cap-record"></a>录制：FLV/FMP4 流式保存**已验证**；SRC 与 Player RTC 适配器会拒绝。这里不协商精确 Chrome/Safari MIME 矩阵。

## 源码地图

- 门面/MVC：[`player.js`](../../../src/player/player.js)、[`player.model.js`](../../../src/player/player.model.js)、[`player.view.js`](../../../src/player/player.view.js)、[`player.controller.js`](../../../src/player/player.controller.js)
- 播放模块：[`src/player/module`](../../../src/player/module)
- 音视频流水线：[`src/player/av`](../../../src/player/av)
- UI／插件：[`src/player/ui`](../../../src/player/ui)

## 已知边界

- FMP4 录制在当前作用域调用 `_writer.write(segment)`，但 `segment` 未定义。
- Player RTC 模块销毁时引用了未声明的 `_sourceTimer` 和 `_onSourceTimer`。
- FLV 和 FMP4 都接受空扩展名，注册顺序会影响选择。
- 没有端到端 DASH/HLS JavaScript 播放、字幕、ABR 或持久断点续传路径。
