<a id="player-sdk"></a>
# Player SDK

[English](player.md) · [产品目标](product-map.zh.md) · [SDK 地图](sdk-map.zh.md)

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

<a id="av-pipeline"></a>
## 音视频流水线

- Codec 注册表：`AAC`、`AVC`。
- Format 注册表：增量 `FLV` 解析器和 `FMP4` 解析／重封装结构。
- FLV/FMP4 模块负责 MediaSource/SourceBuffer 生命周期、缓冲、统计和保存。
- <a id="cap-codecs"></a>H264/AAC 解析与重封装**已验证**。H265/Opus 在这里属于浏览器／RTC 协商能力，不是 Player 编码器。

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

| 插件 | 状态 | 主要职责／配置 |
| --- | --- | --- |
| <a id="cap-poster"></a>`Poster` | **已验证** | `file`、`cors`、`objectfit`、`visibility` |
| `Chat` | **已验证**，依赖 RTC | 本地／远端视频列表；`client`、`rtc`、`service`、`visibility` |
| <a id="cap-comment"></a>`Danmu` | **当前实现已验证** | 弹幕运动；`speed`、`lineHeight`、`enable`、`visibility` |
| <a id="cap-dashboard"></a>`Display` | **已验证** | 状态／错误、元信息和统计面板；`layout`、`ondoubleclick`、`visibility` |
| `AD` | **基础能力已验证** | 插入／移除调用方 DOM；`visibility` |
| `Share` | **基础能力已验证** | 插入调用方 DOM；`visibility` |
| <a id="cap-logo"></a>`Logo` | **已验证** | `file`、`link`、`cors`、`target`、`style`、`visibility` |
| <a id="cap-controlbar"></a>`Controlbar` | **已验证** | 布局驱动控件；`layout`、`autohide`、`visibility` |
| <a id="cap-contextmenu"></a>`ContextMenu` | **已验证** | 可配置菜单项及媒体信息／统计；`items`、`visibility` |
| <a id="cap-content"></a>`Content` 抽象 | **待实现** | Live/WatchParty/RTC/IM 目标尚未注册为插件 |
| <a id="cap-subtitle-plugin"></a>`Subtitle` | **待实现** | 没有解析器、渲染器或插件 |
| <a id="cap-sidebar"></a>`Sidebar` | **待实现** | Userlist/Playlist/Tools/Settings/Layout 尚未注册 |
| <a id="cap-dialog"></a>`Dialog` Notify/Alert/Confirm | **待实现** | IM 的会话 Dialog 是另一种组件 |

### Controlbar 组件

进度条；播放／暂停／重载／停止；直播提示和时间；反馈；截图／下载；呼叫／挂断；静音和音量；清晰度；弹幕；大屏／全屏。平台能力或配置不满足时，对应控件不会创建。

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

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](player-api.zh.md#接口) | 工厂、注册表、Player/UI 实例、播放模块、插件与 AV Stream 扩展接口 |

core 与 UI 均提供同 id 的 `get/create` 注册表：多实例已**验证**。

## 事件

<a id="cap-events"></a>

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](player-api.zh.md#事件) | Player、传输、媒体、保存、UI 以及已声明但不可达的事件与负载 |

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
