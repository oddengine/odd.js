<a id="rtc-sdk"></a>
# RTC SDK

[English](rtc.md) · [产品目标](architecture.zh.md#目标树) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [门面](#facade)
- [NetStream](#netstream)
- [媒体辅助模块](#media-helpers)
- [功能特征](#功能特征)
- [插件](#插件)
- [配置](#配置)
- [接口](#接口)
  - [Core 静态接口](#core-静态接口)
  - [Core 实例接口](#core-实例接口)
  - [NetStream 实例接口](#netstream-实例接口)
- [事件](#事件)
  - [Event](#event)
  - [NetStatusEvent](#netstatusevent)
  - [SaverEvent](#saverevent)
- [审核依据](#审核依据)
- [信令能力](#信令能力)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.rtc`。在线演示：[互动直播](https://oddengine.com/zh/solution/interactive.html)、[视频会议](https://oddengine.com/zh/solution/conference.html)、[呼叫](https://oddengine.com/zh/solution/call.html)。

<a id="facade"></a>
## 门面

`RTC` 管理发布者／订阅者 `NetStream` 和周期统计。它可以独立运行，也可以接收 IM `NetConnection`；后者提供用户身份，SDP 和媒体仍通过 WHIP/WHEP 传输。

<a id="netstream"></a>
## NetStream

<a id="cap-whip-whep"></a>`NetStream` 负责 `RTCPeerConnection`、本地预览／发布、WHEP 订阅、SDP Codec 偏好、可选 Trickle ICE、轨道变化、浏览器录制和清理。

| 路径 | 状态 | 网络行为 |
| --- | --- | --- |
| WHIP 发布 | **已验证** | `POST application/sdp`、读取 `Location`、可选 PATCH Trickle、释放时 DELETE |
| WHEP 播放 | **已验证** | 同样的资源生命周期，远端轨道挂到自动播放 video |
| Player RTC 适配器 | **已验证**，有清理风险 | 将 WHEP 事件／状态转换为 Player 模块契约 |

<a id="media-helpers"></a>
## 媒体辅助模块

| 模块 | 职责 |
| --- | --- |
| `Constraints` | 从低分辨率到 1080P 的命名采集档位 |
| `Stats` | 归一化 RTC 统计 |
| `AudioMeter` | WebAudio 音量测量 |
| <a id="cap-beauty"></a>`Beauty` | WebGL 亮度／磨皮；以 Canvas `captureStream` 输出 |
| `Mixer`、`AudioMixer`、`VideoMixer` | 统一混流接口以及 Canvas／Audio 合成 |

## 功能特征

- **多实例与多流：**稳定的 RTC 实例可以同时管理多个发布者和订阅者。
- **采集与合成：**摄像头、麦克风、屏幕分享、屏幕叠加摄像头、命名档位和运行时约束共用一套 Stream 流程。
- **协商控制：**Codec 偏好、ICE 配置、可选 Trickle ICE 和 WHIP/WHEP 资源生命周期均可配置。
- **媒体处理：**SDK 内置动态轨道、WebGL 美颜、音量测量、统计归一化和浏览器录制。
- SDK 门面管理集合，每个 `NetStream` 独占一个 Peer/HTTP 资源生命周期。
- WHIP/WHEP HTTP 资源与可选的 IM 身份／控制传输分离。
- 设备采集、约束、协商、录制、统计、美颜、混流分别放在聚焦模块中。
- 动态轨道直接操作 RTCRtpSender，不必重建整个 SDK。
- 同一 Stream 对象暴露 `video`、`stream`、属性、状态和事件，便于 UI 集成。

## 插件

RTC 没有独立 UI 包。`Beauty`、`AudioMeter` 和 Mixer 是媒体辅助模块，不是 UI 插件。Player 的 `Chat` 插件会使用本 SDK。

## 配置

| 分组 | 配置项 |
| --- | --- |
| 端点 | `whip`、`whep`、`trickle` |
| 媒体 | `profile`、`codecpreferences` |
| 请求／会话 | `parameters.token`、`rtcconfiguration` |
| 录制服务 | `service.script`、`service.scope`、`service.enable` |

`NetStream` 默认值还包含 ICE Server 和 `iceTransportPolicy`；采集约束包含音视频设备 id、facing mode 和光标策略。

## 接口

<a id="cap-dynamic-tracks"></a>
<a id="cap-rtc-record"></a>

当前源码没有 RTC `call()` 方法；通用远程调用属于 IM，旧 RTC 文档中的 `call()` 已过期。

当前源码没有 RTC UI 门面。公开 API 由 Core 静态接口、Core 实例门面，以及 preview、publish、play 返回的 `NetStream` 对象组成。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 RTC Core，不存在时创建。由 `RTC.get` 实现，并通过 `odd.rtc` 暴露。 |
| `create` | netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 RTC Core。 |
| `getDevices` | logger?: Logger \| LoggerConfig | 枚举全部媒体设备。 |
| `getCameras` | logger?: Logger \| LoggerConfig | 枚举视频输入设备。 |
| `getMicrophones` | logger?: Logger \| LoggerConfig | 枚举音频输入设备。 |
| `getPlaybackDevices` | logger?: Logger \| LoggerConfig | 枚举音频输出设备。 |
| `getSupportedCodecs` | logger?: Logger \| LoggerConfig | **骨架：** 接口已存在，但当前实现没有返回结果。 |

### Core 实例接口

`state` 在 `setup()` 时挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | config?: RTCConfig | 初始化 RTC 门面与统计定时器。 |
| `client` | — | 返回可选的 IM 连接。 |
| `preview` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建并返回本地预览 `NetStream`。 |
| `publish` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建预览并通过 WHIP 发布。 |
| `unpublish` | — | 释放全部发布流。 |
| `play` | resourceId: string | 创建并返回订阅 `NetStream`。 |
| `stop` | resourceId?: string | 停止一个或全部订阅。 |
| `state` | — | 返回 RTC 门面状态。 |
| `destroy` | reason?: string | 释放全部流并移除 Core 实例。 |

### NetStream 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `pid` | — | 返回本地 pipe id。 |
| `uuid` | — | 存在时返回流 UUID。 |
| `client` | — | 返回绑定的 IM 连接。 |
| `attach` | netConnection?: NetConnection | 创建 PeerConnection 并绑定信令。 |
| `setProperty` | key: string, value: unknown | 保存流元数据。 |
| `getProperty` | key: string | 返回流元数据。 |
| `applyConstraints` | constraints: MediaStreamConstraints | 将约束应用到已有本地轨道。 |
| `setCamera` | deviceId: string | 选择摄像头，并在支持时替换活动视频轨。 |
| `setMicrophone` | deviceId: string | 在活动约束中选择麦克风。 |
| `setProfile` | profile: string | 应用命名的采集配置。 |
| `setResolution` | width: number, height: number | 更新视频分辨率约束。 |
| `setFramerate` | fps: number | 更新视频帧率约束。 |
| `setBitrate` | bitrate: number | 更新最大发送码率。 |
| `getUserMedia` | constraints: MediaStreamConstraints | 采集摄像头和/或麦克风。 |
| `getDisplayMedia` | constraints: DisplayMediaStreamOptions | 采集屏幕媒体。 |
| `addTrack` | track: MediaStreamTrack, stream: MediaStream | 向 PeerConnection 添加发布轨道。 |
| `replaceTrack` | track: MediaStreamTrack, stopprevious?: boolean | 替换匹配的发送轨道。 |
| `removeTrack` | sender: RTCRtpSender | 从 PeerConnection 移除发送器。 |
| `createStream` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建摄像头/麦克风或组合屏幕媒体。 |
| `preview` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 必要时创建媒体并绑定到视频元素。 |
| `publish` | — | 通过 WHIP 协商并发布本地媒体。 |
| `beauty` | enable: boolean, constraints?: BeautyConstraints | 启用或关闭 WebGL 美颜处理。 |
| `beautyEnabled` | — | 返回当前美颜状态。 |
| `play` | resourceId: string, mode?: string | 通过 WHEP 协商只接收播放。 |
| `stop` | name?: string | 停止并释放流。 |
| `record` | filename: string, ondata?: (chunk: Blob) => void | 使用 `MediaRecorder` 录制流。 |
| `getTransceivers` | — | 返回 PeerConnection 的 transceiver。 |
| `getSenders` | — | 返回 PeerConnection 的 sender。 |
| `getReceivers` | — | 返回 PeerConnection 的 receiver。 |
| `volume` | — | 返回归一化音量计数值。 |
| `getStats` | — | 返回解析后的 PeerConnection 统计。 |
| `state` | — | 返回流状态。 |
| `release` | reason?: string | 释放远端 WHIP/WHEP 资源并在本地关闭。 |
| `close` | reason?: string | 停止轨道、录制、媒体与 PeerConnection。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | RTC 初始化完成，运行时接口可用。 |
| READY | — | RTC Core 已就绪。 |
| ERROR | name: string, message: string | **Core 预留：** 当前大多数失败通过 Promise 拒绝返回。 |
| RELEASE | reason?: string | `NetStream` 已释放远端与本地资源；Core 消费该事件以更新流集合。 |
| CLOSE | reason?: string | **Core 预留：** 关闭处理器存在，但当前未注册。 |

### NetStatusEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | 收到发布/播放状态，包括轨道发布、播放、取消发布与停止通知。 |

### SaverEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | `NetStream` 录制写入器已打开。 |
| WRITEREND | writer: StreamWriter | `NetStream` 录制写入器已结束。 |

原生协商、轨道、ICE 与连接状态回调由内部处理，不属于 SDK 事件类型。

## 审核依据

- [`rtc.js`](../../../src/rtc/rtc.js)
- [`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- [`src/rtc`](../../../src/rtc)

## 信令能力

<a id="cap-publish-subscribe"></a>发布／订阅通过 WHIP/WHEP **已验证**。

<a id="cap-call-control"></a>呼叫／接听／拒绝／超时的产品状态机**待实现**。通用 `call()` 属于 IM，当前 RTC 接口中不存在。

<a id="cap-mute"></a>闭麦为**部分实现**：可以让输出 video 静音或禁用轨道，但没有统一的远端闭麦控制协议。

<a id="cap-kick"></a>RTC 内的踢出能力**待实现**。

<a id="cap-record-signal"></a>开始／停止录制信令为**部分实现**：有本地录制，没有统一的分布式录制命令和状态。

<a id="cap-end"></a>结束通过 stop/release/DELETE **部分具备**，但没有 Call 生命周期抽象。

## 源码地图

- 门面与工厂：[`rtc.js`](../../../src/rtc/rtc.js)
- Peer／会话实现：[`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- 约束／统计／媒体辅助：[`src/rtc`](../../../src/rtc)
- Player 适配器：[`module.rtc.js`](../../../src/player/module/module.rtc.js)

## 已知边界

- `RTC.getSupportedCodecs()` 为空。
- HTTP 请求没有从 `parameters.token` 构造 Authorization Header。
- 创建 `MediaRecorder` 时未指定 MIME 协商，精确浏览器编码／封装矩阵未验证。
- Beauty 依赖 WebGL 和 Canvas Capture；Player Chat 在 Apple WebKit 上禁用它。
- 没有自动化的协商、浏览器矩阵或重连测试。
